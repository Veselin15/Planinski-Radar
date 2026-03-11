import os

from django.contrib.auth import get_user_model
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()


class GoogleIDTokenAuthentication(BaseAuthentication):
    """
    Authenticate requests with a Google ID token from Authorization header.
    """

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None

        raw_token = auth_header.split(" ", 1)[1].strip()
        if not raw_token:
            raise AuthenticationFailed("Missing bearer token.")

        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        if not google_client_id:
            raise AuthenticationFailed("Google authentication is not configured.")

        try:
            payload = id_token.verify_oauth2_token(
                raw_token,
                google_requests.Request(),
                audience=google_client_id,
            )
        except Exception as error:
            raise AuthenticationFailed("Invalid Google token.") from error

        issuer = payload.get("iss")
        if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
            raise AuthenticationFailed("Invalid token issuer.")

        google_sub = payload.get("sub")
        if not google_sub:
            raise AuthenticationFailed("Invalid token subject.")

        email = payload.get("email", "")
        full_name = payload.get("name", "").strip()
        first_name, _, last_name = full_name.partition(" ")
        username = f"google_{google_sub}"

        user, _ = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
            },
        )

        # Keep local profile in sync with latest Google account metadata.
        has_changes = False
        if email and user.email != email:
            user.email = email
            has_changes = True
        if first_name and user.first_name != first_name:
            user.first_name = first_name
            has_changes = True
        if last_name and user.last_name != last_name:
            user.last_name = last_name
            has_changes = True
        if user.has_usable_password():
            user.set_unusable_password()
            has_changes = True
        if has_changes:
            user.save()

        return (user, None)
