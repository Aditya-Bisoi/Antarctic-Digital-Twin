from django.urls import path
from . import views

urlpatterns = [
    path('stations/', views.list_stations, name='station-list'),
    path('stations/<str:pk>/', views.station_detail, name='station-detail'),
    path('stations/<str:pk>/dashboard/', views.station_dashboard, name='station-dashboard'),
    path('stations/<str:pk>/energy/', views.station_energy, name='station-energy'),
    path('stations/<str:pk>/energy/history/', views.station_energy_history, name='station-energy-history'),
    path('stations/<str:pk>/environment/', views.station_environment, name='station-environment'),
    path('stations/<str:pk>/environment/history/', views.station_environment_history, name='station-environment-history'),
    path('stations/<str:pk>/alerts/', views.station_alerts, name='station-alerts'),
    path('stations/<str:pk>/simulate/', views.simulate_scenario, name='station-simulate'),
    path('alerts/', views.station_alerts, name='all-alerts'),
]
