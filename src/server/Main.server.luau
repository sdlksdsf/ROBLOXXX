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
