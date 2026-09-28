"""
ml — Predictive Machine Learning Module for Equipment Failure & RUL
Antarctic Digital Twin — SIH26060
"""

from .predict import get_equipment_ml_prediction, load_active_model

__all__ = ['get_equipment_ml_prediction', 'load_active_model']
