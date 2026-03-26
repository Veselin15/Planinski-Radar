# 📐 Системна архитектура: Планински Радар

Този документ описва техническия стак, потока на данни (Data Flow) и структурата на базата данни на приложението. Системата използва декуплирана (decoupled) архитектура с отделен Frontend (Next.js) и Backend (Django REST).

---

## 1. Технологичен Стак (Tech Stack)

### Frontend (Client-Side)
* **Фреймуърк:** Next.js (App Router) с React.
* **Стилизиране:** Tailwind CSS (за бърз и responsive дизайн).
* **Картография:** `react-leaflet` (Leaflet.js) за рендиране на интерактивната карта.
* **Картографски данни (Tile Server):** BGMountains (`bgmtile.kade.si`) за топографски плочки (tiles).
* **Аутентикация:** NextAuth.js (вход с Google OAuth).
* **PWA:** Конфигуриран `manifest.json` за инсталиране като мобилно приложение.

### Backend (Server-Side)
* **Фреймуърк:** Python 3.12 + Django.
* **API:** Django REST Framework (DRF) за изграждане на RESTful endpoints.
* **Географски изчисления:** `django.contrib.gis` (GeoDjango) за работа с пространствени данни (Spatial Data).

### База Данни & Инфраструктура
* **СУБД:** PostgreSQL.
* **Пространствено разширение:** PostGIS (позволява търсене по радиус и запазване на координати).
* **Контейнеризация:** Docker & Docker Compose (за лесно стартиране на локална среда).

---

## 2. Поток на данните (Data Flow)

Системата комуникира по следния начин:

1. **Зареждане на картата:** Next.js клиента тегли базовите картографски плочки (с пътеките и изолиниите) директно от външния сървър на BGMountains.
2. **Вземане на маркерите:** Next.js прави `GET` заявка към Django API-то. Django използва PostGIS, за да извлече всички активни опасности и хижи, форматира ги като `GeoJSON` и ги връща на фронтенда.
3. **Подаване на сигнал:** При натискане на бутона "Изпрати сигнал", фронтендът създава `FormData` обект (съдържащ координати, текст и снимка) и прави `POST` заявка към Django. Снимката се запазва в локалната папка `media`, а записът отива в PostgreSQL.
4. **Аутентикация:** NextAuth.js управлява сесията чрез JWT токени, комуникирайки директно със сървърите на Google. Фронтендът изпраща името на логнатия потребител към бекенда при създаване на сигнал.

---

## 3. Схема на Базата Данни (Database Schema)

Основните модели в GeoDjango бекенда (`map_data` app):

### Модел: `Hazard` (Опасности)
Пази информация за всички сигнали, подадени от потребителите.
* `id`: UUID / Primary Key
* `location`: PointField (PostGIS координати: Longitude, Latitude)
* `category`: CharField (Лавина, Заледяване, Паднало дърво, Друго)
* `description`: TextField
* `image`: ImageField (Опционална снимка)
* `upvotes`: IntegerField (Брой потвърждения от други потребители, default: 0)
* `author_name`: CharField (Името на подателя от Google Auth)
* `is_active`: BooleanField (Дали сигналът е все още актуален)
* `created_at`: DateTimeField (Време на създаване)

### Модел: `Hut` (Хижи) - *Static Data*
* `id`: Primary Key
* `name`: CharField (Име на хижата/заслона)
* `location`: PointField (PostGIS координати)
* `capacity`: IntegerField (Капацитет легла)
* `phone`: CharField (Телефон за връзка)

---

## 4. REST API Endpoints (Core)

Всички endpoints се намират на `/api/`:

* `GET /api/hazards/` 
  * *Description:* Returns all active hazards in GeoJSON format.
* `POST /api/hazards/` 
  * *Description:* Creates a new hazard. Accepts `multipart/form-data` for image uploads.
* `POST /api/hazards/<id>/upvote/` 
  * *Description:* Increments the upvote counter for a specific hazard. Returns the new count.
* `GET /api/huts/` 
  * *Description:* Returns all huts in GeoJSON format.
