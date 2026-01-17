# ChatServer

Krótka dokumentacja i wskazówki dotyczące projektu serwera czatu.

## Cel projektu

Celem tego repozytorium jest dostarczenie prostego, edukacyjnego serwera czatu z naciskiem na aspekty programowania rozproszonego. Projekt demonstruje i umożliwia eksperymentowanie z:
- komunikacją w czasie rzeczywistym przy użyciu WebSocketów,
- skalowaniem poziomym serwera przy użyciu Redis jako mechanizmu pub/sub do synchronizacji wiadomości między wieloma instancjami,
- konteneryzacją (Docker / docker-compose),
- integracją z prostym frontendem (React).

## Wdrożenie w Azure (produkcja)

Projekt został zoptymalizowany pod kątem **zerowych kosztów** (Free Tier) dla celów edukacyjnych i zaliczeniowych. Wdrożenie wykorzystuje darmowe plany i zewnętrzne usługi tam, gdzie Azure jest płatny.

### Architektura "Zero Kosztów"

1.  **Hosting (Compute)**: Azure App Service (Plan **F1 Free Tier**)
    *   Hostuje aplikację w trybie "Code" (ZIP deploy), nie Kontenerów (Docker w F1 nie jest dostępny).
    *   System: Linux.
2.  **Baza danych / Broker**: Redis Cloud (Free Tier 30MB)
    *   Zastępuje płatny Azure Cache for Redis (~60zł/msc).
    *   Wystarcza na obsługę tysięcy wiadomości.
3.  **CI/CD**: GitLab CI/CD (Free)
    *   Automatycznie buduje Frontend (React), Backend (.NET) i wysyła na Azure po `git push`.


## Technologie i kontekst programowania rozproszonego

Najważniejsze technologie użyte w projekcie:

- ASP.NET Core — hostowanie serwera HTTP i endpointów WebSocket.
- Pipelines.Sockets (or native WebSocket APIs) — obsługa połączeń WebSocket.
- StackExchange.Redis i Redis — centralny broker pub/sub używany do przesyłania wiadomości pomiędzy instancjami serwera; umożliwia to skalowanie horyzontalne i zachowanie spójności komunikatów w środowisku rozproszonym.
- Docker / docker-compose — konteneryzacja aplikacji i zależności (np. Redis), ułatwiająca lokalne uruchomienie i wdrożenie w środowisku rozproszonym.
- React (folder `frontend`) — prosty klient webowy demonstrujący interakcję w czasie rzeczywistym.

Jak te elementy wspierają programowanie rozproszone:
- Redis pub/sub działa jako warstwa komunikacji międzyinstancyjnej — dzięki temu wiele procesów/instancji może wymieniać wiadomości bez trzymania współdzielonego stanu w pamięci lokalnej.
- Projekt promuje bezstanowość serwerów (stateless): serwery mogą być replikowane i umieszczone za load balancerem; synchronizacja wiadomości odbywa się przez Redis.
- Konteneryzacja pozwala łatwo uruchomić wiele instancji (np. w klastrze), testować load balancery i zachowania rozproszone.


## Szybki start (lokalnie)

- Backend (ASP.NET Core):

```bash
cd ChatServer
dotnet run
```

- Frontend (dev):

```bash
cd frontend
npm install
npm run dev
```

- Alternatywnie uruchom wszystko przez Docker Compose (uruchamia też Redis):

```bash
docker-compose up --build
```