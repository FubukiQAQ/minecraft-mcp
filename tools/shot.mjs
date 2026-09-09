// 截取 Minecraft 窗口到 PNG。
//   node tools/shot.mjs <输出文件> [窗口标题关键字]
// 依赖 PowerShell + System.Drawing（Windows）。

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outFile = resolve(process.argv[2] ?? "shot.png");
const titleFilter = process.argv[3] ?? "Minecraft";
mkdirSync(dirname(outFile), { recursive: true });

const ps = `
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
}
"@
$p = Get-Process | Where-Object { $_.MainWindowTitle -like "*${titleFilter}*" } | Select-Object -First 1
if (-not $p) { Write-Error "找不到窗口: ${titleFilter}"; exit 1 }
$h = $p.MainWindowHandle
[W]::ShowWindow($h, 9) | Out-Null
[W]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 900
$r = New-Object W+RECT
[W]::GetClientRect($h, [ref]$r) | Out-Null
$pt = New-Object W+POINT
$pt.X = 0; $pt.Y = 0
[W]::ClientToScreen($h, [ref]$pt) | Out-Null
$w = $r.R - $r.L; $hh = $r.B - $r.T
$bmp = New-Object System.Drawing.Bitmap($w, $hh)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($pt.X, $pt.Y, 0, 0, (New-Object System.Drawing.Size($w, $hh)))
$bmp.Save("${outFile.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "$w x $hh"
`;

try {
  execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], {
    stdio: "inherit",
  });
  console.log("截图完成:", outFile);
} catch (e) {
  console.error("截图失败:", e.message);
  process.exit(1);
}
