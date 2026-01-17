#!/bin/bash

#KONFIGURACJA
APP_NAME="WebChatServer"
RESOURCE_GROUP="ChatFreePL"

echo "--------------------------------------------------"
echo "   Rozpoczynam aktualizację aplikacji na Azure..."
echo "--------------------------------------------------"

echo "[1/5] Budowanie Frontendu..."
cd frontend
npm run build
if [ $? -ne 0 ]; then
    echo "Błąd budowania frontendu!"
    exit 1
fi
cd ..

echo "[2/5] Kopiowanie plików do Backendu..."
mkdir -p ChatServer/wwwroot
rm -rf ChatServer/wwwroot/*
cp -R frontend/build/* ChatServer/wwwroot/

echo "[3/5] Publikacja Backendu (.NET)..."
cd ChatServer
dotnet publish -c Release -o ./publish
if [ $? -ne 0 ]; then
    echo "Błąd kompilacji backendu!"
    exit 1
fi

echo "[4/5] Tworzenie paczki wdrodżeniowej (ZIP)..."
cd publish
zip -r ../app.zip . > /dev/null
cd ..

az webapp deployment source config-zip --resource-group $RESOURCE_GROUP --name $APP_NAME --src app.zip

echo "--------------------------------------------------"
echo "Aplikacja została zaktualizowana."
echo "Adres: https://$APP_NAME.azurewebsites.net"
echo "--------------------------------------------------"
