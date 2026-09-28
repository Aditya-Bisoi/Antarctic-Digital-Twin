"""
evaluate.py — Rigorous Model Evaluation & Baseline Comparison
Antarctic Digital Twin — SIH26060

Evaluates precision, recall, F1, accuracy, confusion matrix, ROC-AUC (classification),
and MAE, RMSE, R² (regression), comparing directly against simple baseline models.
"""

import os
import json
from typing import Dict, Any, Tuple
import numpy as np

from .features import FeatureScaler, FEATURE_NAMES
from .dataset import generate_polar_degradation_dataset, chronological_train_val_test_split
from .train import LogisticRegressionModel, RidgeRegressionModel, train_and_persist_models


def calculate_classification_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_proba: np.ndarray) -> Dict[str, Any]:
    """Calculates precision, recall, F1, accuracy, confusion matrix, and ROC-AUC."""
    tp = int(np.sum((y_true == 1) & (y_pred == 1)))
    fp = int(np.sum((y_true == 0) & (y_pred == 1)))
    fn = int(np.sum((y_true == 1) & (y_pred == 0)))
    tn = int(np.sum((y_true == 0) & (y_pred == 0)))

    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    f1 = 2 * (precision * recall) / max(precision + recall, 1e-6)
    accuracy = (tp + tn) / max(len(y_true), 1)

    # Approximate ROC-AUC via rank-sum (Mann-Whitney U)
    pos_mask = (y_true == 1)
    n_pos = np.sum(pos_mask)
    n_neg = len(y_true) - n_pos

    if n_pos > 0 and n_neg > 0:
        ranks = np.argsort(np.argsort(y_proba)) + 1
        roc_auc = (np.sum(ranks[pos_mask]) - n_pos * (n_pos + 1) / 2.0) / (n_pos * n_neg)
    else:
        roc_auc = 0.5

    return {
        'precision': round(float(precision), 4),
        'recall': round(float(recall), 4),
        'f1': round(float(f1), 4),
        'accuracy': round(float(accuracy), 4),
        'roc_auc': round(float(roc_auc), 4),
        'confusion_matrix': {
            'true_negatives': tn,
            'false_positives': fp,
            'false_negatives': fn,
            'true_positives': tp,
        }
    }


def calculate_regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    """Calculates MAE, RMSE, and R²."""
    errors = y_true - y_pred
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors ** 2)))

    ss_res = np.sum(errors ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r2 = 1.0 - (ss_res / max(ss_tot, 1e-6))

    return {
        'mae': round(mae, 2),
        'rmse': round(rmse, 2),
        'r2': round(float(r2), 4),
    }


def run_evaluation() -> Dict[str, Any]:
    """
    Evaluates trained models on the held-out test set and compares against simple heuristic baselines.
    """
    models_dir = os.path.join(os.path.dirname(__file__), 'models')
    model_file = os.path.join(models_dir, 'degradation_model.json')

    if not os.path.exists(model_file):
        train_and_persist_models(models_dir)

    with open(model_file, 'r', encoding='utf-8') as f:
        artifact = json.load(f)

    # Generate identical test split
    X, y_class, y_reg = generate_polar_degradation_dataset(num_episodes=180, hours_per_episode=72)
    _, _, _, _, X_test, y_c_test = chronological_train_val_test_split(X, y_class)
    _, _, _, _, _, y_r_test = chronological_train_val_test_split(X, y_reg)

    # Scaler
    scaler = FeatureScaler.from_dict(artifact['scaler'])
    X_test_scaled = scaler.transform(X_test)

    # ML Classifier inference
    clf = LogisticRegressionModel()
    clf.weights = np.array(artifact['classifier_weights'], dtype=np.float32)
    clf.bias = artifact['classifier_bias']

    ml_probs = clf.predict_proba(X_test_scaled)
    ml_class_preds = clf.predict(X_test_scaled)
    ml_clf_metrics = calculate_classification_metrics(y_c_test, ml_class_preds, ml_probs)

    # Baseline Classifier: Threshold-based heuristic (predict failure if health < 45% or temp_dev > 10)
    # Feature 0 is health, Feature 7 is temp_dev
    health_idx = FEATURE_NAMES.index('health')
    temp_dev_idx = FEATURE_NAMES.index('temp_deviation')
    baseline_class_preds = ((X_test[:, health_idx] < 45.0) | (X_test[:, temp_dev_idx] > 10.0)).astype(np.int32)
    baseline_probs = np.clip(1.0 - (X_test[:, health_idx] / 100.0), 0.0, 1.0)
    baseline_clf_metrics = calculate_classification_metrics(y_c_test, baseline_class_preds, baseline_probs)

    # ML Regressor inference
    reg = RidgeRegressionModel()
    reg.weights = np.array(artifact['regressor_weights'], dtype=np.float32)
    reg.bias = artifact['regressor_bias']
    ml_rul_preds = reg.predict(X_test_scaled)
    ml_reg_metrics = calculate_regression_metrics(y_r_test, ml_rul_preds)

    # Baseline Regressor: Simple constant rate extrapolation (RUL = health / 0.5)
    baseline_rul_preds = np.maximum(0.0, X_test[:, health_idx] / 0.5)
    baseline_reg_metrics = calculate_regression_metrics(y_r_test, baseline_rul_preds)

    # Comparison summary
    report = {
        'model_version': artifact['model_version'],
        'test_samples': len(X_test),
        'classification_failure_within_48h': {
            'ml_model': ml_clf_metrics,
            'heuristic_baseline': baseline_clf_metrics,
            'ml_outperforms_baseline_f1': ml_clf_metrics['f1'] > baseline_clf_metrics['f1'],
        },
        'regression_remaining_useful_life': {
            'ml_model': ml_reg_metrics,
            'heuristic_baseline': baseline_reg_metrics,
            'ml_outperforms_baseline_mae': ml_reg_metrics['mae'] < baseline_reg_metrics['mae'],
        },
    }

    # Save evaluation report
    eval_file = os.path.join(models_dir, 'evaluation_report.json')
    with open(eval_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)

    return report


if __name__ == '__main__':
    rep = run_evaluation()
    print("=== MODEL EVALUATION REPORT ===")
    print(json.dumps(rep, indent=2))
