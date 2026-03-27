------------------------------------------------------------------------------------------------------------------------------------------------------
🔄 Redeploy Backend (ASP.NET Core)
------------------------------------------------------------------------------------------------------------------------------------------------------
Every time you make changes to the backend:

powershell:
cd C:\Users\elopez24\Documents\stockwell-build\backend\BuildTrack.API
dotnet publish -c Release -o ./publish

Then in VS Code:
Click Azure icon in sidebar
Find buildtrack-api under App Services
Right-click → Deploy to Web App...
Select the publish folder
Click Deploy

------------------------------------------------------------------------------------------------------------------------------------------------------
🔄 Redeploy Frontend (React/Vite)
------------------------------------------------------------------------------------------------------------------------------------------------------
Every time you make changes to the frontend:

powershell:
cd C:\Users\elopez24\Documents\stockwell-build\frontend
npm run build

powershell:
swa deploy ./dist --deployment-token a53c96a3b32f49ada6a9944bd17e7abf1cc85658ef0f13823b6d5249b0ce319002-f2f717be-749e-4a42-ae72-bb39b9b88c4100016160725c8e00 --env production

💡 Pro Tip — Save as scripts
deploy-backend.ps1:
powershellcd C:\Users\elopez24\Documents\stockwell-build\backend\BuildTrack.API
dotnet publish -c Release -o ./publish
Write-Host "✅ Published! Now deploy via VS Code → Right-click buildtrack-api → Deploy to Web App → select publish folder"
deploy-frontend.ps1:
powershellcd C:\Users\elopez24\Documents\stockwell-build\frontend
npm run build
swa deploy ./dist --deployment-token a53c96a3b32f49ada6a9944bd17e7abf1cc85658ef0f13823b6d5249b0ce319002-f2f717be-749e-4a42-ae72-bb39b9b88c4100016160725c8e00 --env production
Write-Host "✅ Frontend deployed!"
Save these in your project root and just run them whenever you have updates! 👍