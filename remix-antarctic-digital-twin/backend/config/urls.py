from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from django.http import HttpResponse, FileResponse
from pathlib import Path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

DIST_DIR = Path(__file__).resolve().parent.parent.parent / 'dist'


def serve_spa(request):
    index_file = DIST_DIR / 'index.html'
    if index_file.exists():
        with open(index_file, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/html; charset=utf-8')
    
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Antarctic Digital Twin — API Gateway</title>
  <style>
    body { background: #0b1120; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 32px; max-width: 580px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
    .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); padding: 5px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
    h1 { margin: 0 0 10px 0; font-size: 24px; color: #38bdf8; font-weight: 700; }
    p { color: #94a3b8; line-height: 1.6; margin: 0 0 20px 0; font-size: 15px; }
    .notice { font-size: 13px; color: #e2e8f0; background: rgba(56, 189, 248, 0.1); border-left: 3px solid #38bdf8; padding: 12px 14px; border-radius: 4px; margin-bottom: 24px; line-height: 1.5; }
    .links { display: flex; flex-direction: column; gap: 10px; }
    a { display: flex; justify-content: space-between; align-items: center; background: #0f172a; border: 1px solid #334155; padding: 12px 16px; border-radius: 8px; color: #38bdf8; text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; }
    a:hover { border-color: #38bdf8; background: #172554; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="dot"></span> Backend API Service Active &amp; Operational</div>
    <h1>Antarctic Digital Twin</h1>
    <p>Django REST Framework API service is running telemetry, simulation engine, and predictive intelligence for <strong>Maitri Station</strong> &amp; <strong>Bharati Station</strong>.</p>
    <div class="notice">
      💡 <strong>Looking for the 3D Dashboard UI?</strong><br />
      If you deployed the Frontend as a Render <strong>Static Site</strong>, open your <strong>Frontend Static Site URL</strong>.
    </div>
    <div class="links">
      <a href="/api/stations/" target="_blank">📡 View All Stations API <span>&rarr;</span></a>
      <a href="/api/stations/maitri/dashboard/" target="_blank">📊 Maitri Station Dashboard API <span>&rarr;</span></a>
      <a href="/api/stations/bharati/dashboard/" target="_blank">📊 Bharati Station Dashboard API <span>&rarr;</span></a>
      <a href="/admin/" target="_blank">🔐 Django Admin Portal <span>&rarr;</span></a>
    </div>
  </div>
</body>
</html>"""
    return HttpResponse(html, content_type='text/html; charset=utf-8')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include('stations.urls')),
    path('api/', include('simulation.urls')),

    # Static assets compiled by Vite
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': DIST_DIR / 'assets'}),
    re_path(r'^images/(?P<path>.*)$', serve, {'document_root': DIST_DIR / 'images'}),
    re_path(r'^(?P<path>[^/]+\.(?:png|jpg|jpeg|gif|svg|ico|json|txt|js|css|woff|woff2|ttf))$', serve, {'document_root': DIST_DIR}),

    # Frontend Single Page App catch-all route (must be last)
    re_path(r'^(?!api/|admin/|static/).*$', serve_spa, name='spa'),
]
