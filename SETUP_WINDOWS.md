<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Hướng dẫn setup môi trường phát triển (Windows)

Hướng dẫn này dành cho việc chạy Apache Superset ở chế độ phát triển trên
Windows, dựa trên cấu trúc repo hiện có.

> **Chạy mọi lệnh trong WSL2 shell.** Superset không hỗ trợ native Windows.
> Các lệnh viết ở dưới dùng cú pháp PowerShell cho các đoạn cần `New-Item`,
> `Test-NetConnection`... nhưng repo phải nằm trong filesystem Linux và lệnh
> `docker compose` nên chạy từ WSL2 shell để tránh bị chậm do filesystem bridge.
> Xem mục 1.1.

- Backend: Flask / Python (thư mục `superset/`)
- Frontend: React / TypeScript (thư mục `superset-frontend/`)
- Metadata store: PostgreSQL
- Cache / broker: Redis

---

## 1. Yêu cầu hệ thống

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| WSL2 | bản mới nhất | Bắt buộc — xem mục 1.1 |
| Docker Desktop | >= 24 | Bắt buộc cho cách cài đặt được khuyên dùng |
| Docker Compose plugin | **>= 2.24.0** | Bắt buộc — xem ghi chú bên dưới |
| Python | 3.11 hoặc 3.12 | Chỉ cần cho hướng dẫn local (mục 4) |
| Node.js / npm | Theo `superset-frontend/package.json` | Chỉ cần cho hướng dẫn local (mục 4) |
| Git | bất kỳ | Bắt buộc |

> **Vì sao cần Compose >= 2.24.0:** `docker-compose.yml` khai báo `env_file` theo
> dạng dài (`- path: ..., required: true|false`) cho mọi service. Cú pháp `required`
> chỉ được hỗ trợ từ Compose 2.24.0. Docker Desktop cũ sẽ báo lỗi kiểu
> `env_file must be a mapping` hoặc `additional properties are not allowed`
> (`required`), dễ bị hiểu nhầm là sai cấu hình. Nếu lỗi này xuất hiện, nâng
> Docker Desktop lại thay vì sửa YAML.

Kiểm tra nhanh:

```powershell
docker --version
docker compose version
```

Cả hai lệnh phải chạy được (exit 0) trước khi đi tiếp.

### 1.1. WSL2 và vị trí thư mục repo

Bắt buộc dùng **WSL2** với Docker Desktop ở chế độ WSL integration. Superset
không hỗ trợ native Windows, và stack dev này bind-mount nặng:

```yaml
- ./superset-frontend:/app/superset-frontend
```

Khi repo nằm trên ổ `C:\`, Docker Desktop phải đọc file qua filesystem bridge
(9P/gRPC-FS). Ở đó `npm ci` và webpack watch sẽ **rất chậm** và thường hỏng
file watch (`ENOSPC: System limit for number of file watchers` hoặc webpack không
rebuild khi sửa file).

**Luôn đặt repo trong filesystem Linux của WSL2:**

```powershell
# mở WSL2 shell
wsl
cd ~
git clone https://github.com/nguyenad1905/superset.git
cd superset
```

Sau đó mọi lệnh `docker compose` trong tài liệu này chạy từ WSL2 shell (hoặc từ
PowerShell đã mount đúng đường dẫn). Lưu ý: nếu chạy lệnh từ cả PowerShell và
WSL cùng lúc, chúng là hai project riêng — chỉ chạy ở một nơi.

---

## 2. Cài đặt bằng Docker Compose (khuyên dùng)

Đây là phương thức được dự án khuyên dùng cho môi trường phát triển. Nó tránh
được các vấn đề tương thích nền tảng của phần lớn dependency Python (xem mục 4).

### 2.1. Kiểm tra cổng trống

Các cổng mặc định của stack: `80` (nginx), `8088` (superset), `9000` (webpack dev
server), `8080` (websocket), `5432` (postgres), `6379` (redis).

```powershell
foreach ($p in @(80,8088,9000,8080,5432,6379)) {
  $inUse = Test-NetConnection -ComputerName localhost -Port $p -InformationLevel Quiet -WarningAction SilentlyContinue
  Write-Host "Port $p : $(if($inUse){'IN USE'}else{'FREE'})"
}
```

Nếu một cổng đã bị chiếm (thường là `5432` khi máy đã cài PostgreSQL sẵn), xem
mục 3 để đổi cổng.

### 2.2. Cấu hình cổng host

Ghi các cổng **host** vào file `.env` ở thư mục gốc repo:

```dotenv
# Docker Compose host port overrides.
# This file is used ONLY for Compose variable interpolation (${...}) in
# docker-compose.yml. It is never copied into the images nor passed into
# containers, so container-internal values (e.g. DATABASE_PORT=5432 inside
# the db container) stay untouched.
COMPOSE_PROJECT_NAME=superset
NGINX_PORT=80
SUPERSET_PORT=8088
NODE_PORT=9000
WEBSOCKET_PORT=8080
DATABASE_PORT=5434
REDIS_PORT=6379
```

> `.env` ở thư mục gốc đã nằm trong `.gitignore` nên không bị commit.

### 2.3. Khởi động stack

Kiểm tra cấu hình Compose trước khi build — bước này bắt lỗi cú pháp/env nhanh
hơn nhiều so với đợi build xong mới lỗi:

```powershell
docker compose config -q
docker compose config --services
```

Lệnh đầu phải exit 0 không in gì ra. Lệnh sau phải liệt kê 9 service:
`nginx`, `redis`, `db`, `superset`, `superset-websocket`, `superset-init`,
`superset-node`, `superset-worker`, `superset-worker-beat`.

Sau đó khởi động:

```powershell
docker compose up -d
```

Lần chạy đầu tiên cần build image, có thể mất khoảng 10–30 phút. Các lần sau
tái sử dụng cache.

### 2.4. Chờ cho tới khi thật sự sẵn sàng

**Container `Up` KHÔNG có nghĩa là app đã dùng được.** Chuỗi khởi động có thứ tự
và các bước sau đều chậm:

1. `superset-init` chạy `db upgrade` → tạo admin → `superset init` → `load-examples`.
   Bước `load-examples` là bước **chậm nhất**, nhiều phút. Script có kiểm tra
   dữ liệu mẫu đã tồn tại chưa nên các lần sau sẽ bỏ qua.
2. `superset` chỉ khởi động **sau khi** `superset-init` exit 0
   (`depends_on: service_completed_successfully`).
3. `superset-node` chạy `npm ci` rồi webpack compile, có thể mất nhiều phút.
4. `nginx` chờ tối đa **~10 phút** cho webpack phục vụ `manifest.json` trước khi
   khởi động.

Theo dõi toàn bộ quá trình:

```powershell
docker compose logs -f superset-init
```

Chờ init kết thúc (exit code 0 — hiện `Exited (0)` là bình thường):

```powershell
docker compose ps -a superset-init --format "table {{.Service}}\t{{.Status}}"
```

Chỉ khi `superset-init` đã `Exited (0)` mới chuyển sang bước kiểm tra. Nếu init
fail, xem mục 7.1.

### 2.5. Kiểm tra

```powershell
docker compose ps -a --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
Invoke-WebRequest -Uri "http://localhost:8088/health" -UseBasicParsing
```

Kết quả mong đợi: HTTP `200` với nội dung `OK`.

Kiểm tra thêm frontend đã compile xong chưa (nếu build xong mà vẫn trả lỗi thì
webpack chưa sẵn sàng — xem mục 7.6):

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:9000/static/assets/manifest.json
```

Kết quả mong đợi: `200`.

> Nếu bước này fail ngay sau `up -d`, đọc lại mục 2.4 — thường là đang kiểm tra
> quá sớm, không phải cấu hình sai.

---

## 3. Cổng host và cổng nội bộ container

Hai nhóm cổng này có ý nghĩa khác nhau và là nguồn gây nhầm lẫn phổ biến nhất:

| Cổng | Nơi khai báo | Ý nghĩa |
|---|---|---|
| Host | `.env` (thư mục gốc) | Chỉ dùng cho Compose interpolation (`${...}`) trong `docker-compose.yml` |
| Nội bộ container | `docker/.env` | Giá trị mà tiến trình trong container thực sự dùng |

Ví dụ `DATABASE_PORT`:

- `.env` (gốc) khai báo `DATABASE_PORT=5434` → ánh xạ host `127.0.0.1:5434` →
  container `5432`.
- `docker/.env` khai báo `DATABASE_PORT=5432` → app trong container kết nối tới
  Postgres ở port `5432` (đúng port Postgres thực sự lắng nghe).

Nếu đặt `DATABASE_PORT=5434` trong `docker/.env` (hoặc `docker/.env-local`) thì app
trong container sẽ tìm Postgres ở port `5434` và báo lỗi:

```
psycopg2.OperationalError: connection to server at "db" (172.x.x.x), port 5434 failed:
Connection refused
```

Tương tự, `REDIS_PORT` trong container phải giữ `6379`.

### 3.1. Về `docker/.env-local`

`docker/.env-local` là file override **cho container** (được khai báo trong
`env_file` của các service trong `docker-compose.yml`). Vì vậy file này chỉ nên
chứa các biến an toàn khi đặt trong container — ví dụ `SUPERSET_LOG_LEVEL`.

Bản `.env-local.example` mặc định chứa các cổng của "instance thứ 2"
(`DATABASE_PORT=5433`, `REDIS_PORT=6380`, `SUPERSET_PORT=8089`...). Copy nguyên
file này sang `.env-local` sẽ làm hỏng kết nối nội bộ của container, vì các
giá trị đó ghi đè `docker/.env`.

Hướng dẫn này dùng `.env` ở thư mục gốc cho cổng host, nên `docker/.env-local`
không cần tồn tại.

---

## 4. Cài đặt bằng Python local (không khuyên dùng trên Windows)

### 4.1. Tạo virtual environment

`uv` không nhận virtual environment tạo bằng module `venv` của Python trên
PowerShell, nên phải dùng `uv venv`:

```powershell
uv venv
.\.venv\Scripts\activate
python --version
```

### 4.2. Cài dependencies

```powershell
uv pip install -r requirements/development.txt
```

Lệnh này **thất bại trên Windows** vì `requirements/development.txt` chứa các gói
chỉ có wheel cho Linux/macOS, ví dụ:

```
databend-driver==0.34.2 has no wheels with a matching platform tag (e.g. `win_amd64`)
Wheels are available for `databend-driver` (v0.34.2) on the following platforms:
  manylinux_2_17_x86_64, manylinux_2_28_aarch64, manylinux2014_x86_64,
  macosx_10_12_x86_64, macosx_11_0_arm64
```

Vì vậy hãy dùng Docker Compose (mục 2) khi phát triển trên Windows.

### 4.3. Các bước còn lại (trên Linux/macOS)

```bash
make venv            # tạo venv với python3.11/python3.12
make activate        # kích hoạt venv
make install         # cài deps + tạo admin + init DB + load examples
```

Hoặc làm thủ công:

```bash
pip install uv
uv pip install -r requirements/development.txt
uv pip install -e .

superset fab create-admin \
  --username admin --firstname "Admin I." --lastname Strator \
  --email admin@superset.io --password general
superset db upgrade
superset init
superset load-examples

cd superset-frontend && npm ci
```

---

## 5. Truy cập và tài khoản

| Mục đích | URL |
|---|---|
| Superset (qua nginx) | http://localhost:80 |
| Superset (trực tiếp) | http://localhost:8088 |
| Frontend dev server (webpack) | http://localhost:9000 |
| Swagger UI | http://localhost:8088/swagger/v1 |

Tài khoản admin do `docker/docker-init.sh` tạo:

| Trường | Giá trị |
|---|---|
| Username | `admin` |
| Password | `admin` |
| Email | `admin@superset.com` |

Đổi mật khẩu qua biến môi trường `ADMIN_PASSWORD` trước khi khởi động lần đầu.

Kiểm tra đăng nhập qua API:

```powershell
$r = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/security/login" `
  -Method Post -ContentType "application/json" `
  -Body '{"username":"admin","password":"admin","provider":"db","refresh":true}'
$r.access_token
```

---

## 6. Lệnh quản lý thường dùng

```powershell
docker compose ps                          # trạng thái các container
docker compose logs -f superset            # log backend
docker compose logs -f superset-node       # log webpack dev server
docker compose logs -f superset-init       # log quá trình init DB / load examples
docker compose up -d                      # khởi động lại (giữ volume)
docker compose down                        # dừng, giữ nguyên volume
docker compose build superset              # build lại image
```

> ### ⚠️ `docker compose down -v` — XÓA DỮ LIỆU
>
> **Không dùng trong quy trình thường ngày.** Cờ `-v` xóa các named volume:
> `db_home` (Postgres — toàn bộ user, database connection, dataset, chart,
> dashboard), `superset_home` (metadata) và `redis`.
>
> Sau khi chạy, phải `docker compose up -d` và init lại từ đầu. Chỉ dùng khi
> cần reset sạch một môi trường hỏng **và** đã chấp nhận mất toàn bộ dữ liệu
> dev. Backup volume `db_home` trước nếu còn dữ liệu cần giữ.

### 6.1. Vòng đời phát triển

- **Backend (Python):** code được bind-mount từ host và container chạy
  `flask run --reload`. Sửa file Python sẽ **tự reload**, **không cần** restart.
  Khởi động lại container thậm chí còn chậm hơn: `docker-bootstrap.sh` chạy
  `uv pip install -e .` mỗi lần start nên mất vài phút (xem 7.3).
- **Frontend (TypeScript):** webpack dev server có hot-reload, thay đổi được
  phản ánh ngay tại http://localhost:9000. Không cần restart.
- **Migration:** nếu thay đổi model cần chạy
  `docker compose exec superset superset db upgrade`.
- **Đổi config trong `docker/.env` hoặc `docker/.env-local`:** `restart` không
  nạp lại env — phải `docker compose up -d` để recreate container.

---

## 7. Xử lý sự cố

### 7.1. `superset-init` báo lỗi và exit 1

Đây gần như luôn là vấn đề cổng nội bộ container. Xem mục 3. Kiểm tra nhanh:

```powershell
docker compose config --format json | ConvertFrom-Json |
  ForEach-Object { $_.services.'superset-init'.environment } | Format-List
```

Giá trị `DATABASE_PORT` phải là `5432` và `REDIS_PORT` phải là `6379`.

### 7.2. `ports are not available: ... bind: An attempt was made to access a socket in a way forbidden by its access permissions`

Windows reserve một số dải cổng cho Hyper-V/WSL. Xem dải bị reserve:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

Chọn cổng nằm ngoài các dải này và cập nhật trong `.env` gốc.

### 7.3. Container `superset` báo `unhealthy` lúc khởi động

Container `superset` cài lại package ở chế độ editable (`uv pip install -e .`) mỗi
lần khởi động, nên mất vài phút trước khi app sẵn sàng. Healthcheck sẽ trở lại
`healthy` sau đó.

### 7.4. `docker compose up` báo lỗi build image

Xóa cache và build lại:

```powershell
docker compose build --no-cache superset
```

### 7.5. `env_file must be a mapping` hoặc lỗi Compose không hiểu `required`

`docker-compose.yml` dùng `env_file` dạng dài có `required`. Cần Compose plugin
**>= 2.24.0**. Nâng Docker Desktop lên bản mới nhất rồi chạy lại:

```powershell
docker compose version
docker compose config -q
```

Không sửa YAML để "né" lỗi.

### 7.6. Frontend trắng trang, 404 asset, hoặc webpack chưa sẵn sàng

Xem log của `superset-node` — `npm ci` và webpack compile mất nhiều phút:

```powershell
docker compose logs -f superset-node
```

Kiểm tra manifest:

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:9000/static/assets/manifest.json
```

Trong lúc chờ, truy cập thẳng webpack dev server ở http://localhost:9000 thay
vì qua nginx (`http://localhost:80`) — nginx chỉ khởi động **sau khi** manifest
sẵn sàng (tối đa ~10 phút).

Nếu webpack không tự rebuild khi sửa file, thường do repo đang nằm trên ổ
`C:\` (xem mục 1.1) hoặc hết file watcher:

```powershell
wsl -e bash -c "sysctl fs.inotify.max_user_watches"
```

### 7.7. Reset toàn bộ môi trường

> ⚠️ **Mất toàn bộ dữ liệu dev.** Xem cảnh báo ở mục 6 trước khi chạy.

```powershell
docker compose down -v
docker compose up -d
```

Sau khi `down -v`, `superset-init` chạy lại từ đầu và nạp examples trở lại.

---

## 8. Ghi chú về file cấu hình trong repo

| File | Vai trò | Có commit? |
|---|---|---|
| `.env` (thư mục gốc) | Cổng host cho Compose interpolation | Không (`.gitignore`) |
| `docker/.env` | Cấu hình môi trường bên trong container | Có |
| `docker/.env-local.example` | Mẫu override cho container | Có |
| `docker/pythonpath_dev/superset_config.py` | Config Superset dùng trong container | Có |
| `.flaskenv` | `FLASK_APP`, `FLASK_DEBUG` cho Flask CLI | Có |

> ### ⚠️ Về `SUPERSET_SECRET_KEY`
>
> `docker/.env` trong repo để sẵn `SUPERSET_SECRET_KEY=TEST_NON_DEV_SECRET` — một
> giá trị cố định và công khai. **Chỉ dùng cho local dev**, không sao chép nguyên
> cấu hình này lên host dùng chung hoặc môi trường có dữ liệu thật.
>
> Nếu cần đổi, tạo `docker/.env-local` (đã gitignore) và sinh khóa riêng:
>
> ```powershell
> # chỉ chạy khi file chưa có key; không chạy lại trên volume đang dùng
> New-Item -ItemType File -Force -Path docker/.env-local | Out-Null
> "SUPERSET_SECRET_KEY=" + (openssl rand -hex 42) | Add-Content docker/.env-local
> ```

### 8.1. Ghi chú về `docker/.env-local`

Nếu tạo file này, chỉ đặt biến **an toàn trong container** (ví dụ
`SUPERSET_LOG_LEVEL`, `SUPERSET_SECRET_KEY`). Không đặt `NODE_PORT`,
`SUPERSET_PORT`, `DATABASE_PORT`, `REDIS_PORT` vào đây — các biến này phải đặt
ở `.env` thư mục gốc (xem mục 3).
