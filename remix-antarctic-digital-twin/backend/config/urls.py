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
    return HttpResponse("Frontend build not found. Run 'npm run build' first.", status=404)


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
