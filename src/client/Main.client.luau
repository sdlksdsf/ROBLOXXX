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
