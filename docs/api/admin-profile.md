# SevaNest Admin Profile API Specification

**Specification Version:** 1.0.0  
**Target Module:** Administrative Account & Staff Profile (`/account`)  
**Base Path:** `/api/v1`  
**Authentication:** Bearer JWT (`Authorization: Bearer <token>`)

---

## 1. Overview

This document specifies the backend contracts for managing the authenticated administrator's personal account profile and credentials. These endpoints operate strictly on the authenticated session (`/me`), eliminating the need to pass target user IDs in requests.

---

## 2. Endpoints

### 2.1. GET `/api/v1/admin/me/profile`
Fetches the profile and identity records for the currently authenticated administrator.

- **Method:** `GET`
- **Path:** `/api/v1/admin/me/profile`
- **Headers:**
  - `Authorization: Bearer <accessToken>` (Required)
  - `Accept: application/json`
- **Response `200 OK`:**
  ```json
  {
    "id": "01a11eec-ff90-73c8-972a-b88e3151ada0",
    "staffId": "STF-ADM-001",
    "name": "Super Administrator",
    "email": "sevanest@admin.in",
    "phone": "+91 98765 43210",
    "role": "SUPER_ADMIN",
    "status": "ACTIVE",
    "avatarUrl": "https://cdn.sevanest.internal/avatars/admin-001.webp",
    "permissions": ["*"],
    "createdAt": "2026-01-15T08:30:00.000Z",
    "updatedAt": "2026-11-06T12:00:00.000Z"
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: Token missing, invalid, or expired.
  - `403 Forbidden`: Authenticated user lacks administrative privileges.
  - `404 Not Found`: Profile record does not exist or endpoint route not yet deployed.

---

### 2.2. PATCH `/api/v1/admin/me/profile`
Performs partial updates on the authenticated administrator's profile.

- **Method:** `PATCH`
- **Path:** `/api/v1/admin/me/profile`
- **Headers:**
  - `Authorization: Bearer <accessToken>` (Required)
  - `Content-Type: application/json`
- **Request Body (`UpdateAdminProfileDto`):**
  ```json
  {
    "name": "Updated Name",
    "email": "updated.email@sevanest.in",
    "phone": "+91 98765 12345"
  }
  ```
  *Note:* All fields are optional to support partial updates.
- **Server-Controlled Fields (Immutable via this endpoint):**
  - `id`, `staffId`, `role`, `status`, `permissions` cannot be modified by the client. Attempting to pass them is rejected or ignored by the server.
- **Response `200 OK`:**
  Returns the updated profile object.
- **Error Responses:**
  - `400 Bad Request` / `422 Unprocessable Entity`: Validation failure (e.g. invalid email format, invalid phone length).
  - `409 Conflict`: Duplicate email or phone number already in use by another account:
    ```json
    {
      "statusCode": 409,
      "error": "Conflict",
      "message": "Email address or phone number is already registered to another account."
    }
    ```
  - `401 Unauthorized`: Token missing or invalid.

---

### 2.3. POST `/api/v1/admin/me/profile-photo`
Uploads or replaces the authenticated administrator's profile avatar photo.

- **Method:** `POST`
- **Path:** `/api/v1/admin/me/profile-photo`
- **Headers:**
  - `Authorization: Bearer <accessToken>` (Required)
  - `Content-Type: multipart/form-data`
- **Multipart Body:**
  - `photo` (or `file`): Binary image data
- **Restrictions:**
  - **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`
  - **Max File Size:** `2 MB` (2,097,152 bytes)
- **Response `200 OK` / `201 Created`:**
  ```json
  {
    "photoUrl": "https://cdn.sevanest.internal/avatars/admin-001.webp",
    "message": "Profile photo uploaded successfully."
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Invalid file type or corrupted image.
  - `413 Payload Too Large`: Image file exceeds 2 MB limit.
  - `401 Unauthorized`: Token missing or expired.

---

### 2.4. POST `/api/v1/admin/account/password`
(Existing authoritative password change contract preserved)

- **Method:** `POST`
- **Path:** `/api/v1/admin/account/password`
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "currentPassword": "OldPassword@123",
    "newPassword": "NewStrongPassword@2026"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "message": "Password changed successfully."
  }
  ```

