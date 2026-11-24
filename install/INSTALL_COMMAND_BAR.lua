--[[
	=============================================================
	 ROBLOXXX — ONE-TIME QUICK INSTALLER (Command Bar method)
	=============================================================
	HOW TO USE (about 60 seconds):
	   1. Open Roblox Studio and open ANY place (new Baseplate is fine)
	   2. Click the "View" tab → "Command Bar" (a small input bar appears)
	   3. Select ALL the text of THIS file, copy it, paste it into
	      the Command Bar, and press Enter
	   4. Press Play — you should see the ROBLOXXX banner and a
	      glowing pad you can click for Points

	SAFETY: This script ONLY edits the place you currently have open
	in Studio (it creates parts and scripts inside the place).
	It does NOT touch your computer, files, settings, or accounts.
	You can re-run it any time — it replaces its own outputs cleanly.
	=============================================================
]]

local function clear(parent, name)
	local existing = parent:FindFirstChild(name)
	if existing then
		existing:Destroy()
	end
end

-- ======================= WORLD =======================
clear(workspace, "Baseplate")
local baseplate = Instance.new("Part")
baseplate.Name = "Baseplate"
baseplate.Anchored = true
baseplate.Size = Vector3.new(512, 20, 512)
baseplate.Position = Vector3.new(0, -10, 0)
baseplate.Color = Color3.fromRGB(163, 162, 165)
baseplate.Parent = workspace

clear(workspace, "SpawnLocation")
local spawn = Instance.new("SpawnLocation")
spawn.Name = "SpawnLocation"
spawn.Anchored = true
spawn.Size = Vector3.new(12, 1, 12)
spawn.Position = Vector3.new(0, 0.5, 0)
spawn.Neutral = true
spawn.Duration = 0
spawn.Parent = workspace

clear(workspace, "ClickPad")
local clickPad = Instance.new("Part")
clickPad.Name = "ClickPad"
clickPad.Anchored = true
clickPad.Size = Vector3.new(8, 1, 8)
clickPad.Position = Vector3.new(14, 0.5, 0)
clickPad.Color = Color3.fromRGB(255, 200, 40)
clickPad.Material = Enum.Material.Neon
clickPad.Parent = workspace

-- ================== SHARED CONFIG ====================
clear(game:GetService("ReplicatedStorage"), "Shared")
local shared = Instance.new("Folder")
shared.Name = "Shared"
shared.Parent = game:GetService("ReplicatedStorage")

local gameConfig = Instance.new("ModuleScript")
gameConfig.Name = "GameConfig"
gameConfig.Source = [==[
--[[
	GameConfig — shared by BOTH server and client.
	Source of truth for tuning values. Edit once, both sides update.
]]

local GameConfig = {
	GameName = "ROBLOXXX",
	WelcomeHint = "Click the glowing pad to earn Points!",
	PointsPerClick = 1,
	StartPoints = 0,
}

return GameConfig
]==]
gameConfig.Parent = shared

-- ====================== SERVER =======================
clear(game:GetService("ServerScriptService"), "Server")
local serverFolder = Instance.new("Folder")
serverFolder.Name = "Server"
serverFolder.Parent = game:GetService("ServerScriptService")

local mainServer = Instance.new("Script")
mainServer.Name = "Main"
mainServer.Source = [==[
--[[
	ROBLOXXX server bootstrap
	- creates leaderstats (Points) for every player
	- makes the ClickPad interactive: click → +Points → client toast
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local GameConfig = require(Shared:WaitForChild("GameConfig"))

-- RemoteEvent used to push feedback to the client UI
local Remotes = Instance.new("Folder")
Remotes.Name = "Remotes"
Remotes.Parent = ReplicatedStorage

local PointsChanged = Instance.new("RemoteEvent")
PointsChanged.Name = "PointsChanged"
PointsChanged.Parent = Remotes

local function setupPlayer(player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"

	local points = Instance.new("IntValue")
	points.Name = "Points"
	points.Value = GameConfig.StartPoints
	points.Parent = leaderstats

	leaderstats.Parent = player
end

Players.PlayerAdded:Connect(setupPlayer)
for _, player in Players:GetPlayers() do
	setupPlayer(player)
end

-- Interactive glowing pad
local clickPad = workspace:WaitForChild("ClickPad")
clickPad.Color = Color3.fromRGB(255, 200, 40)
clickPad.Material = Enum.Material.Neon

local detector = Instance.new("ClickDetector")
detector.MaxActivationDistance = 40
detector.Parent = clickPad

detector.MouseClick:Connect(function(player)
	local leaderstats = player:FindFirstChild("leaderstats")
	if not leaderstats then
		return
	end
	local points = leaderstats:FindFirstChild("Points")
	if not points then
		return
	end
	points.Value = points.Value + GameConfig.PointsPerClick
	PointsChanged:FireClient(player, points.Value)
end)

print("[ROBLOXXX] Server ready — " .. GameConfig.GameName)
]==]
mainServer.Parent = serverFolder

-- ======================= CLIENT =======================
clear(game:GetService("StarterPlayer").StarterPlayerScripts, "Client")
local clientFolder = Instance.new("Folder")
clientFolder.Name = "Client"
clientFolder.Parent = game:GetService("StarterPlayer").StarterPlayerScripts

local mainClient = Instance.new("LocalScript")
mainClient.Name = "Main"
mainClient.Source = [==[
--[[
	ROBLOXXX client UI
	- welcome banner + hint
	- "+1 (N Points)" toast whenever the server confirms a click
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local GameConfig = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("GameConfig"))
local PointsChanged = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("PointsChanged")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local gui = Instance.new("ScreenGui")
gui.Name = "ROBLOXXX_UI"
gui.ResetOnSpawn = false
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = playerGui

-- Banner with the game title
local banner = Instance.new("TextLabel")
banner.Name = "Banner"
banner.AnchorPoint = Vector2.new(0.5, 0)
banner.Position = UDim2.new(0.5, 0, 0, 12)
banner.Size = UDim2.new(0, 440, 0, 56)
banner.BackgroundColor3 = Color3.fromRGB(18, 18, 26)
banner.BackgroundTransparency = 0.2
banner.Text = GameConfig.GameName
banner.TextColor3 = Color3.fromRGB(255, 215, 80)
banner.TextScaled = true
banner.Font = Enum.Font.GothamBlack
banner.Parent = gui

local bannerCorner = Instance.new("UICorner")
bannerCorner.CornerRadius = UDim.new(0, 14)
bannerCorner.Parent = banner

local bannerStroke = Instance.new("UIStroke")
bannerStroke.Color = Color3.fromRGB(255, 215, 80)
bannerStroke.Thickness = 2
bannerStroke.Transparency = 0.4
bannerStroke.Parent = banner

-- Hint line under the banner
local hint = Instance.new("TextLabel")
hint.Name = "Hint"
hint.AnchorPoint = Vector2.new(0.5, 0)
hint.Position = UDim2.new(0.5, 0, 0, 74)
hint.Size = UDim2.new(0, 560, 0, 24)
hint.BackgroundTransparency = 1
hint.Text = GameConfig.WelcomeHint
hint.TextColor3 = Color3.fromRGB(235, 235, 245)
hint.TextScaled = true
hint.Font = Enum.Font.Gotham
hint.Parent = gui

-- Toast that pops up on every successful click
local toast = Instance.new("TextLabel")
toast.Name = "Toast"
toast.AnchorPoint = Vector2.new(0.5, 0.5)
toast.Position = UDim2.new(0.5, 0, 0.7, 0)
toast.Size = UDim2.new(0, 260, 0, 46)
toast.BackgroundColor3 = Color3.fromRGB(18, 18, 26)
toast.BackgroundTransparency = 1
toast.Text = ""
toast.TextTransparency = 1
toast.TextColor3 = Color3.fromRGB(255, 255, 255)
toast.TextScaled = true
toast.Font = Enum.Font.GothamBold
toast.Parent = gui

local toastCorner = Instance.new("UICorner")
toastCorner.CornerRadius = UDim.new(0, 12)
toastCorner.Parent = toast

local activeTween = nil

local function showToast(message)
	toast.Text = message
	toast.TextTransparency = 0
	toast.BackgroundTransparency = 0.2
	toast.Position = UDim2.new(0.5, 0, 0.7, 0)

	if activeTween then
		activeTween:Cancel()
	end

	activeTween = TweenService:Create(
		toast,
		TweenInfo.new(1.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
		{
			Position = UDim2.new(0.5, 0, 0.62, 0),
			TextTransparency = 1,
			BackgroundTransparency = 1,
		}
	)
	activeTween:Play()
end

PointsChanged.OnClientEvent:Connect(function(totalPoints)
	showToast("+" .. GameConfig.PointsPerClick .. "   " .. totalPoints .. " Points")
end)

print("[ROBLOXXX] Client UI ready")
]==]
mainClient.Parent = clientFolder

print("==================================================")
print(" ROBLOXXX installed successfully!")
print(" Press PLAY to test — click the glowing pad.")
print("==================================================")
