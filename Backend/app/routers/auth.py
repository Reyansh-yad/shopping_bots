from fastapi import APIRouter, Depends, HTTPException
import bcrypt
from app.core.security import get_session, validate_session
from app.schemas.models import ChangePasswordRequest, LoginRequest, LogoutRequest, RegisterRequest
from app.database import get_db_connection

auth = APIRouter(prefix="/auth", tags=["auth"])


@auth.post("/login")
def login(login_request: LoginRequest, conn=Depends(get_db_connection)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT password_hash FROM app.profile WHERE username = %s",
            (login_request.username,)
        )
        result = cur.fetchone()

        if not result:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        stored_hash = result[0]

        if bcrypt.checkpw( login_request.password.encode("utf-8"), stored_hash.encode("utf-8")):
            cur.execute(
                "DELETE FROM app.session WHERE username = %s",
                (login_request.username,)
            )
            session_id = get_session()
            cur.execute(
                "INSERT INTO app.session (session_id, username, expired_at) VALUES (%s, %s, NOW() + INTERVAL '7 days')",
                (session_id, login_request.username)
            )
            conn.commit()
            return {"status": True,
                    "message": "Login successful",
                    "session_id": session_id}
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials")


@auth.post("/register")
def register(register_request: RegisterRequest, conn=Depends(get_db_connection)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT username FROM app.profile WHERE username = %s",
            (register_request.username,)
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Username already exists")

        password_hash = bcrypt.hashpw(
            register_request.password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        cur.execute(
            "INSERT INTO app.profile (username, password_hash) VALUES (%s, %s)",
            (register_request.username, password_hash)
        )
        conn.commit()

        return {"status": True, "message": "User registered successfully"}


@auth.post("/logout")
def logout(logout_request: LogoutRequest, conn=Depends(get_db_connection)):
    if not validate_session(logout_request.session_id):
        raise HTTPException(status_code=401, detail="Invalid session ID")
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM app.session WHERE session_id = %s",
            (logout_request.session_id,)
        )
        conn.commit()
        return {"status": True, "message": "Logout successful"}


@auth.post("/change_password")
def change_password(change_password_request: ChangePasswordRequest, conn=Depends(get_db_connection)):
    if validate_session(change_password_request.session_id):
        with conn.cursor() as cur:
            cur.execute(
                "SELECT password_hash FROM app.profile WHERE username = %s",
                (change_password_request.username,)
            )
            result = cur.fetchone()

            if not result:
                raise HTTPException(status_code=404, detail="User not found")

            stored_hash = result[0]

            if bcrypt.checkpw(change_password_request.old_password.encode("utf-8"), stored_hash):
                new_password_hash = bcrypt.hashpw(
                    change_password_request.new_password.encode("utf-8"),
                    bcrypt.gensalt()
                ).decode("utf-8")

                cur.execute(
                    "UPDATE app.profile SET password_hash = %s WHERE username = %s",
                    (new_password_hash, change_password_request.username)
                )
                conn.commit()
                return {"status": True, "message": "Password changed successfully"}
            else:
                raise HTTPException(status_code=401, detail="Invalid old password")
    else:
        raise HTTPException(status_code=401, detail="Invalid session ID")


@auth.get("/me")
def me(session_id: str, conn=Depends(get_db_connection)):
    """
    Return the username associated with the active session.
    Used by the frontend to confirm authentication state without a full profile fetch.
    Query param: ?session_id=<uuid>
    """
    if not validate_session(session_id):
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.user_id, p.username
            FROM app.session s
            JOIN app.profile p ON s.username = p.username
            WHERE s.session_id = %s
            """,
            (session_id,)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found.")
        user_id, username = row
    return {"status": True, "user_id": user_id, "username": username}
