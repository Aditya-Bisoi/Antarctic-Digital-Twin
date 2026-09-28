"""
dataset.py — Historical Telemetry Dataset Builder & Chronological Splitter
Antarctic Digital Twin — SIH26060

Builds time-series operational dataset with chronological train/val/test splits
to strictly prevent temporal data leakage.
"""

from typing import Tuple, Dict, Any, List
import numpy as np
from .features import extract_features_from_equipment, FEATURE_NAMES


def generate_polar_degradation_dataset(
    num_episodes: int = 150,
    hours_per_episode: int = 72,
    random_seed: int = 42
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Generates realistic polar equipment operating time-series based on physical
    stress curves (thermal shock, vibration amplification, maintenance age).
    
    Returns:
    - X: Feature matrix of shape (N, len(FEATURE_NAMES))
    - y_class: Binary target (1 if component fails within 48h, else 0)
    - y_reg: Continuous target (Remaining Useful Life in hours)
    """
    rng = np.random.RandomState(random_seed)

    X_list: List[np.ndarray] = []
    y_class_list: List[int] = []
    y_reg_list: List[float] = []

    categories = ['generator', 'heating', 'water', 'solar', 'comms']

    for ep in range(num_episodes):
        cat = categories[ep % len(categories)]
        base_health = rng.uniform(70.0, 100.0)
        degrade_rate = rng.uniform(0.1, 1.8) if rng.rand() < 0.35 else rng.uniform(0.01, 0.08)
        initial_temp = 55.0 + rng.uniform(-10.0, 15.0)
        initial_vib = 8.0 + rng.uniform(-3.0, 12.0)
        op_hours = rng.uniform(1000.0, 15000.0)
        maint_age = rng.uniform(5.0, 180.0)

        health = base_health
        for t in range(hours_per_episode):
            health = max(0.0, health - degrade_rate + rng.normal(0, 0.05))
            temp = initial_temp + (100.0 - health) * 0.35 + rng.normal(0, 1.0)
            vib = initial_vib + (100.0 - health) * 0.25 + rng.normal(0, 0.5)
            eff = max(0.5, min(0.98, 0.92 - (100.0 - health) * 0.003))
            load = 60.0 + rng.uniform(-10.0, 30.0)

            eq_record = {
                'category': cat,
                'health': health,
                'temperature': temp,
                'vibration': vib,
                'efficiency': eff,
                'load_percent': load,
                'operating_hours': op_hours + t,
                'maintenance_age_days': maint_age + (t / 24.0),
            }

            feats = extract_features_from_equipment(eq_record)

            # Targets:
            # RUL: hours until health drops to 0 at current degradation trend
            effective_rate = max(0.01, degrade_rate)
            rul = health / effective_rate
            fail_48 = 1 if rul <= 48.0 else 0

            X_list.append(feats)
            y_class_list.append(fail_48)
            y_reg_list.append(min(300.0, rul))

    X = np.array(X_list, dtype=np.float32)
    y_class = np.array(y_class_list, dtype=np.int32)
    y_reg = np.array(y_reg_list, dtype=np.float32)

    return X, y_class, y_reg


def chronological_train_val_test_split(
    X: np.ndarray,
    y: np.ndarray,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Performs chronological split to preserve time-series ordering and prevent data leakage.
    """
    n = len(X)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    X_train, y_train = X[:train_end], y[:train_end]
    X_val, y_val = X[train_end:val_end], y[train_end:val_end]
    X_test, y_test = X[val_end:], y[val_end:]

    return X_train, y_train, X_val, y_val, X_test, y_test
