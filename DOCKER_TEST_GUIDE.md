# Docker 로컬 개발 환경 테스트 가이드

## 🚀 빠른 시작

### 1단계: Docker Desktop 시작

**macOS**:

```bash
# Docker Desktop 앱 실행
open /Applications/Docker.app

# 또는 command line에서
docker ps

# daemon이 시작되면 위 명령이 정상 실행됨
```

### 2단계: Docker Compose 시작

```bash
cd docker
docker-compose up -d

# 또는 로그를 보면서 실행
docker-compose up
```

**예상 출력**:

```
Creating solo-pay-mysql   ... done
Creating solo-pay-redis   ... done
Creating solo-pay-hardhat ... done
Creating solo-pay-gateway  ... done
Creating solo-pay-demo    ... done
```

---

## ✅ 서비스 상태 확인

### 전체 상태 확인

```bash
cd docker
docker-compose ps

# 예상 출력:
NAME              COMMAND                  SERVICE   STATUS           PORTS
solo-pay-mysql      "docker-entrypoint.s…"   mysql     Up (healthy)     0.0.0.0:3306->3306/tcp
solo-pay-redis      "redis-server /usr/l…"   redis     Up (healthy)     0.0.0.0:6379->6379/tcp
solo-pay-hardhat    "npx hardhat node …"     hardhat   Up (healthy)     0.0.0.0:8545->8545/tcp
solo-pay-gateway    "pnpm start"             gateway   Up (healthy)     0.0.0.0:3001->3001/tcp
solo-pay-demo       "pnpm start"             demo      Up (healthy)     0.0.0.0:3000->3000/tcp
```

### 개별 서비스 테스트

#### MySQL

```bash
# MySQL 접속
docker-compose exec mysql mysql -u root -ppass -e "SELECT VERSION();"

# 데이터베이스 확인
docker-compose exec mysql mysql -u root -ppass solopay -e "SHOW TABLES;"

# 예상 테이블:
payments
relay_requests
store_api_keys
```

#### Redis

```bash
# Redis ping 테스트
docker-compose exec redis redis-cli ping

# 메모리 상태
docker-compose exec redis redis-cli INFO memory
```

#### Hardhat

```bash
# HTTP POST로 블록체인 정보 조회
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":67}'

# 예상 응답:
# {"jsonrpc":"2.0","result":"HardhatNetwork/...","id":67}
```

#### Payment Gateway

```bash
# Health check
curl http://localhost:3001/health

# 예상 응답:
# {"status":"ok","timestamp":"2025-11-28T..."}

# Root endpoint
curl http://localhost:3001

# 예상 응답:
# {"service":"Solo Pay Gateway","version":"0.1.0","status":"running"}
```

#### Demo App

```bash
# 브라우저에서 접속
open http://localhost:3000

# 또는 curl로 확인
curl -s http://localhost:3000 | head -20
```

---

## 🔍 로그 확인

### 전체 로그

```bash
docker-compose logs -f

# 또는 특정 서비스만
docker-compose logs -f gateway
docker-compose logs -f hardhat
docker-compose logs -f mysql
```

### 로그 크기 확인

```bash
docker-compose logs --tail=50 gateway
```

---

## 🛑 Docker Compose 중지 및 정리

### 일시 중지

```bash
docker-compose pause

# 재개
docker-compose unpause
```

### 중지

```bash
docker-compose stop

# 다시 시작
docker-compose start
```

### 완전 삭제

```bash
# 컨테이너 삭제 (볼륨 유지)
docker-compose down

# 컨테이너 + 볼륨 삭제
docker-compose down -v

# 컨테이너 + 이미지 + 볼륨 삭제 (재구축 필요)
docker-compose down -v --rmi all
```

---

## 🔧 트러블슈팅

### Port 이미 사용 중

```bash
# 3306 포트 확인
lsof -i :3306

# 프로세스 종료
kill -9 <PID>

# 또는 docker-compose에서 다른 포트로 변경:
ports:
  - "3307:3306"  # 호스트 포트 3307로 변경
```

### MySQL 권한 오류

```bash
# MySQL 컨테이너 재시작
docker-compose restart mysql

# 또는 볼륨 초기화 후 재시작
docker-compose down -v
docker-compose up -d mysql
```

### Hardhat 연결 불가

```bash
# Hardhat 로그 확인
docker-compose logs hardhat

# Hardhat 재시작
docker-compose restart hardhat
```

### 메모리 부족

```bash
# Docker 메모리 할당 증가 (Docker Desktop 설정)
# Preferences → Resources → Memory: 4GB 이상 권장
```

---

## 📊 성능 모니터링

### 리소스 사용량

```bash
docker stats
```

### 컨테이너 상세 정보

```bash
docker inspect solo-pay-gateway
```

---

## 🎯 다음 단계

1. **결제서버 API 개발**

   ```bash
   cd ../packages/gateway
   pnpm dev
   ```

2. **SDK 개발**

   ```bash
   cd ../packages/gateway-sdk
   pnpm dev
   ```

3. **Demo 앱 수정**
   ```bash
   cd ../packages/demo
   pnpm dev
   ```

---

## 📝 Notes

- 모든 환경변수는 `docker-compose.yml`에 하드코딩됨 (`.env` 파일 불필요)
- MySQL 초기화는 `mysql/init.sql`에서 자동 실행
- Health check는 각 서비스의 준비 상태를 확인
- 데이터는 Docker 볼륨에 저장됨 (컨테이너 삭제 후에도 유지, `down -v`로만 삭제)

---

**작성**: 2025-11-28
**상태**: 테스트 준비 완료
