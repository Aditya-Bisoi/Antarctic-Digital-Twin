"""
train.py — Training Pipeline for Equipment Degradation ML Models
Antarctic Digital Twin — SIH26060

Trains Logistic Regression (Failure within 48h) and Ridge Regression (Remaining Useful Life)
using pure NumPy vector operations without external sklearn dependencies.
"""

import os
import json
from datetime import datetime
import numpy as np
from .features import FeatureScaler, FEATURE_NAMES
from .dataset import generate_polar_degradation_dataset, chronological_train_val_test_split


class LogisticRegressionModel:
    """Pure NumPy Logistic Regression with L2 Regularization and numerical stability."""

    def __init__(self, lr: float = 0.05, l2_reg: float = 0.01, epochs: int = 400):
        self.lr = lr
        self.l2_reg = l2_reg
        self.epochs = epochs
        self.weights: Optional[np.ndarray] = None
        self.bias: float = 0.0

    def _sigmoid(self, z: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-np.clip(z, -25.0, 25.0)))

    def fit(self, X: np.ndarray, y: np.ndarray):
        n_samples, n_features = X.shape
        self.weights = np.zeros(n_features, dtype=np.float32)
        self.bias = 0.0

        for _ in range(self.epochs):
            linear = np.dot(X, self.weights) + self.bias
            preds = self._sigmoid(linear)

            # Gradients with L2 penalty on weights
            dw = (1.0 / n_samples) * np.dot(X.T, (preds - y)) + (self.l2_reg * self.weights)
            db = (1.0 / n_samples) * np.sum(preds - y)

            self.weights -= self.lr * dw
            self.bias -= self.lr * db

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        linear = np.dot(X, self.weights) + self.bias
        return self._sigmoid(linear)

    def predict(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        return (self.predict_proba(X) >= threshold).astype(np.int32)


class RidgeRegressionModel:
    """Pure NumPy Ridge Regression (L2 regularized closed-form normal equation)."""

    def __init__(self, alpha: float = 1.0):
        self.alpha = alpha
        self.weights: Optional[np.ndarray] = None
        self.bias: float = 0.0

    def fit(self, X: np.ndarray, y: np.ndarray):
        n_samples, n_features = X.shape
        # Add bias column
        X_b = np.hstack([np.ones((n_samples, 1), dtype=np.float32), X])
        I = np.eye(n_features + 1, dtype=np.float32)
        I[0, 0] = 0.0  # Do not regularize bias

        # Closed form: w = (X^T X + alpha*I)^(-1) X^T y
        theta = np.linalg.solve(np.dot(X_b.T, X_b) + self.alpha * I, np.dot(X_b.T, y))
        self.bias = float(theta[0])
        self.weights = theta[1:]

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.maximum(0.0, np.dot(X, self.weights) + self.bias)


def train_and_persist_models(models_dir: Optional[str] = None) -> Dict[str, Any]:
    """Runs complete dataset generation, split, training, and artifact persistence."""
    if models_dir is None:
        models_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(models_dir, exist_ok=True)

    # 1. Dataset generation
    X, y_class, y_reg = generate_polar_degradation_dataset(num_episodes=180, hours_per_episode=72)

    # 2. Chronological split
    X_train, y_c_train, X_val, y_c_val, X_test, y_c_test = chronological_train_val_test_split(X, y_class)
    _, y_r_train, _, y_r_val, _, y_r_test = chronological_train_val_test_split(X, y_reg)

    # 3. Scaler fitted ONLY on train set
    scaler = FeatureScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)

    # 4. Train Failure Classifier
    clf = LogisticRegressionModel(lr=0.08, l2_reg=0.01, epochs=500)
    clf.fit(X_train_scaled, y_c_train)

    # 5. Train RUL Regressor
    reg = RidgeRegressionModel(alpha=2.0)
    reg.fit(X_train_scaled, y_r_train)

    # 6. Metadata and model package
    artifact = {
        'model_version': 'ml-degradation-v1.0',
        'training_date': datetime.now().isoformat(),
        'features': FEATURE_NAMES,
        'dataset_version': 'polar_synthetic_v1.0',
        'train_samples': len(X_train),
        'val_samples': len(X_val),
        'test_samples': len(X_test),
        'algorithms': {
            'classifier': 'LogisticRegression (L2)',
            'regressor': 'RidgeRegression (Closed-form L2)',
        },
        'hyperparameters': {
            'classifier': {'lr': 0.08, 'l2_reg': 0.01, 'epochs': 500},
            'regressor': {'alpha': 2.0},
        },
        'scaler': scaler.to_dict(),
        'classifier_weights': clf.weights.tolist(),
        'classifier_bias': float(clf.bias),
        'regressor_weights': reg.weights.tolist(),
        'regressor_bias': float(reg.bias),
    }

    target_path = os.path.join(models_dir, 'degradation_model.json')
    with open(target_path, 'w', encoding='utf-8') as f:
        json.dump(artifact, f, indent=2)

    return artifact


if __name__ == '__main__':
    res = train_and_persist_models()
    print(f"Model trained and saved successfully: version={res['model_version']}")
