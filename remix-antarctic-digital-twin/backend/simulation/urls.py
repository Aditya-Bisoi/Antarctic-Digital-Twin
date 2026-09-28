"""
urls.py — URL Routing for Simulation App
Antarctic Digital Twin — SIH26060
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EquipmentViewSet,
    ScenarioViewSet,
    InterventionViewSet,
    SimulationRunViewSet,
    StationOverviewView,
    StationTelemetryView,
    StationTelemetryHistoryView,
    StationEquipmentListView,
    StationPredictionsView,
    StationRecommendationsView,
    StationHistoryView,
    StationEquipmentPredictionView,
    RadarEventView,
)

router = DefaultRouter()
router.register(r'equipment', EquipmentViewSet, basename='equipment')
router.register(r'scenarios', ScenarioViewSet, basename='scenarios')
router.register(r'interventions', InterventionViewSet, basename='interventions')
router.register(r'simulations', SimulationRunViewSet, basename='simulations')

urlpatterns = [
    # Router endpoints
    path('', include(router.urls)),

    # Station aggregate telemetry and intelligence endpoints
    path('stations/<str:pk>/overview/', StationOverviewView.as_view(), name='station-overview'),
    path('stations/<str:pk>/telemetry/', StationTelemetryView.as_view(), name='station-telemetry'),
    path('stations/<str:pk>/telemetry/history/', StationTelemetryHistoryView.as_view(), name='station-telemetry-history'),
    path('stations/<str:pk>/history/', StationHistoryView.as_view(), name='station-history'),
    path('stations/<str:pk>/equipment/', StationEquipmentListView.as_view(), name='station-equipment-list'),
    path('stations/<str:pk>/equipment/<str:equipment_id>/prediction/', StationEquipmentPredictionView.as_view(), name='station-equipment-prediction'),
    path('stations/<str:pk>/predictions/', StationPredictionsView.as_view(), name='station-predictions'),
    path('stations/<str:pk>/recommendations/', StationRecommendationsView.as_view(), name='station-recommendations'),
    path('radar/events/', RadarEventView.as_view(), name='radar-events'),
]
