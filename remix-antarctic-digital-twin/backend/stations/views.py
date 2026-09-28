from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import (
    Station,
    EnergyData,
    EnvironmentData,
    Alert,
    EnergyHistory,
    EnvironmentHistory,
)
from .serializers import (
    StationListSerializer,
    StationDashboardSerializer,
    EnergyDataSerializer,
    EnvironmentDataSerializer,
    AlertSerializer,
    EnergyHistorySerializer,
    EnvironmentHistorySerializer,
)
from .services import generate_ai_insights, run_what_if_simulation


@api_view(['GET'])
@permission_classes([AllowAny])
def list_stations(request):
    """GET /api/stations/"""
    stations = Station.objects.all()
    serializer = StationListSerializer(stations, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def station_detail(request, pk):
    """GET /api/stations/{id}/"""
    station = get_object_or_404(Station, id=pk.lower())
    serializer = StationDashboardSerializer(station)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def station_dashboard(request, pk):
    """GET /api/stations/{id}/dashboard/"""
    station = get_object_or_404(Station, id=pk.lower())
    serializer = StationDashboardSerializer(station)
    data = serializer.data
    
    # Append dynamic rule-based AI insights
    data['aiInsights'] = generate_ai_insights(station)
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def station_energy(request, pk):
    """GET /api/stations/{id}/energy/"""
    station = get_object_or_404(Station, id=pk.lower())
    if hasattr(station, 'energy'):
        serializer = EnergyDataSerializer(station.energy)
        return Response(serializer.data)
    return Response({"detail": "Energy data not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([AllowAny])
def station_energy_history(request, pk):
    """GET /api/stations/{id}/energy/history/"""
    station = get_object_or_404(Station, id=pk.lower())
    history = EnergyHistory.objects.filter(station=station).order_by('id')
    serializer = EnergyHistorySerializer(history, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def station_environment(request, pk):
    """GET /api/stations/{id}/environment/"""
    station = get_object_or_404(Station, id=pk.lower())
    if hasattr(station, 'environment'):
        serializer = EnvironmentDataSerializer(station.environment)
        return Response(serializer.data)
    return Response({"detail": "Environment data not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([AllowAny])
def station_environment_history(request, pk):
    """GET /api/stations/{id}/environment/history/"""
    station = get_object_or_404(Station, id=pk.lower())
    history = EnvironmentHistory.objects.filter(station=station).order_by('id')
    serializer = EnvironmentHistorySerializer(history, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def station_alerts(request, pk=None):
    """GET /api/stations/{id}/alerts/ or GET /api/alerts/"""
    if pk:
        station = get_object_or_404(Station, id=pk.lower())
        alerts = Alert.objects.filter(station=station).order_by('-id')
    else:
        alerts = Alert.objects.all().order_by('-id')
    
    serializer = AlertSerializer(alerts, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def simulate_scenario(request, pk):
    """POST /api/stations/{id}/simulate/"""
    station = get_object_or_404(Station, id=pk.lower())
    scenario = request.data.get('scenario', 'Generator Failure')
    
    simulation_result = run_what_if_simulation(station, scenario)
    return Response({
        "stationId": station.id,
        "stationName": station.name,
        "result": simulation_result
    })
