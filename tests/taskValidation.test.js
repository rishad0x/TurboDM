import { test, expect, describe } from "bun:test";
import {
    sanitizeFilename,
    validateSaveDirPath,
    isReservedDeviceName,
    MAX_FILENAME_LENGTH
} from "../engine/taskValidation.js";

describe("sanitizeFilename", () => {
    test("passes normal names through untouched", () => {
        expect(sanitizeFilename("report.pdf")).toBe("report.pdf");
        expect(sanitizeFilename("My Video (2024).mp4")).toBe("My Video (2024).mp4");
        expect(sanitizeFilename("日本語ファイル.txt")).toBe("日本語ファイル.txt");
        expect(sanitizeFilename(".dotfile")).toBe(".dotfile");
        expect(sanitizeFilename("setup-windows_x64-v2.exe")).toBe("setup-windows_x64-v2.exe");
    });

    test("coerces non-strings; empty/blank → 'download'", () => {
        expect(sanitizeFilename("")).toBe("download");
        expect(sanitizeFilename(null)).toBe("download");
        expect(sanitizeFilename(undefined)).toBe("download");
        expect(sanitizeFilename("   ")).toBe("download");
        expect(sanitizeFilename("...")).toBe("download");
        expect(sanitizeFilename("  a.txt  ")).toBe("a.txt");
        expect(sanitizeFilename(42)).toBe("42");
    });

    test("path traversal and separators: only the final component survives", () => {
        expect(sanitizeFilename("../../../etc/passwd")).toBe("passwd");
        expect(sanitizeFilename("..\\..\\windows\\system32\\evil.exe")).toBe("evil.exe");
        expect(sanitizeFilename("folder/file.txt")).toBe("file.txt");
        expect(sanitizeFilename("..")).toBe("download");
        expect(sanitizeFilename("/")).toBe("download");
        expect(sanitizeFilename("C:\\Users\\me\\report.docx")).toBe("report.docx");
    });

    test("forbidden Windows characters and control chars become underscores", () => {
        expect(sanitizeFilename("a<b>c:d\"e|f?g*h.txt")).toBe("a_b_c_d_e_f_g_h.txt");
        expect(sanitizeFilename("inj\u0000ection.txt")).toBe("inj_ection.txt");
        expect(sanitizeFilename("new\u001Fline.txt")).toBe("new_line.txt");
        expect(sanitizeFilename("del\u007Fchar.txt")).toBe("del_char.txt");
    });

    test("Windows reserved device names are defused (stem before first dot)", () => {
        expect(sanitizeFilename("CON")).toBe("_CON");
        expect(sanitizeFilename("con.txt")).toBe("_con.txt");
        expect(sanitizeFilename("Nul")).toBe("_Nul");
        expect(sanitizeFilename("com1.tar.gz")).toBe("_com1.tar.gz");
        expect(sanitizeFilename("lpt9.pdf")).toBe("_lpt9.pdf");
        expect(sanitizeFilename("con.mp4.bak")).toBe("_con.mp4.bak");
        expect(isReservedDeviceName("con")).toBe(true);
        expect(isReservedDeviceName("Conn.mp4")).toBe(false);
    });

    test("trailing dots/spaces are stripped (NTFS would drop them silently)", () => {
        expect(sanitizeFilename("file.txt...")).toBe("file.txt");
        expect(sanitizeFilename("file.txt ")).toBe("file.txt");
        expect(sanitizeFilename("name.")).toBe("name");
        expect(sanitizeFilename("file . . .")).toBe("file");
                expect(sanitizeFilename("my file.v2.txt")).toBe("my file.v2.txt");
    });

    test("length limit truncates but preserves the extension", () => {
        const out = sanitizeFilename("x".repeat(300) + ".mp4");
        expect(out.length).toBeLessThanOrEqual(MAX_FILENAME_LENGTH);
        expect(out.endsWith(".mp4")).toBe(true);
        expect(sanitizeFilename("y".repeat(300))).toHaveLength(MAX_FILENAME_LENGTH);
                expect(/[.\s]$/.test(out)).toBe(false);
    });
});

describe("validateSaveDirPath", () => {
    test("accepts absolute Windows drive paths (both slash styles)", () => {
        expect(validateSaveDirPath("C:\\Users\\me\\Downloads").ok).toBe(true);
        expect(validateSaveDirPath("C:/Users/me/Downloads").ok).toBe(true);
        expect(validateSaveDirPath("C:\\").ok).toBe(true);
        expect(validateSaveDirPath("d:\\media").ok).toBe(true);
    });

    test("accepts UNC network paths and POSIX absolute paths", () => {
        expect(validateSaveDirPath("\\\\NAS\\share\\media").ok).toBe(true);
        expect(validateSaveDirPath("/home/user/Downloads").ok).toBe(true);
        expect(validateSaveDirPath("/").ok).toBe(true);
    });

    test("rejects relative, drive-relative, blank and non-string input", () => {
        expect(validateSaveDirPath("Downloads").ok).toBe(false);
        expect(validateSaveDirPath(".\\Downloads").ok).toBe(false);
        expect(validateSaveDirPath("C:Downloads").ok).toBe(false);
        expect(validateSaveDirPath("").ok).toBe(false);
        expect(validateSaveDirPath("   ").ok).toBe(false);
        expect(validateSaveDirPath(null).ok).toBe(false);
        expect(validateSaveDirPath(undefined).ok).toBe(false);
    });

    test("rejects traversal segments but allows '..' inside a legal name", () => {
        expect(validateSaveDirPath("C:\\Users\\..\\evil").ok).toBe(false);
        expect(validateSaveDirPath("C:/safe/../evil").ok).toBe(false);
        expect(validateSaveDirPath("/tmp/../escape").ok).toBe(false);
        expect(validateSaveDirPath("\\\\NAS\\share\\..\\evil").ok).toBe(false);
        expect(validateSaveDirPath("C:\\a..b").ok).toBe(true);
        expect(validateSaveDirPath("C:\\..data").ok).toBe(true);
    });

    test("rejects control characters and oversized paths", () => {
        expect(validateSaveDirPath("C:\\bad\u0000path").ok).toBe(false);
        expect(validateSaveDirPath("C:\\new\u001Bline").ok).toBe(false);
        expect(validateSaveDirPath("C:\\" + "x".repeat(1100)).ok).toBe(false);
    });

    test("rejects trailing dots on the final segment; trailing whitespace is trimmed", () => {
        expect(validateSaveDirPath("C:\\folder.").ok).toBe(false);
        expect(validateSaveDirPath("/tmp/dir.").ok).toBe(false);
                        expect(validateSaveDirPath("C:\\folder ").ok).toBe(true);
        expect(validateSaveDirPath("C:\\folder ").dir).toBe("C:\\folder");
    });

    test("rejects reserved device names as the final folder", () => {
        expect(validateSaveDirPath("C:\\CON").ok).toBe(false);
        expect(validateSaveDirPath("C:\\data\\nul").ok).toBe(false);
        expect(validateSaveDirPath("C:\\data\\nul2").ok).toBe(true);
    });

    test("reasons are human-readable (surfaced to the extension)", () => {
        expect(validateSaveDirPath("relative\\path").reason).toContain("absolute");
        expect(validateSaveDirPath("C:\\..\\x").reason).toContain('.."');
    });
});

describe("validateSaveDirPath system-location deny-list", () => {
    test("denies the Windows directory incl. subfolders and any case", () => {
        expect(validateSaveDirPath("C:\\Windows").ok).toBe(false);
        expect(validateSaveDirPath("C:\\WINDOWS\\System32\\drivers").ok).toBe(false);
        expect(validateSaveDirPath("C:/windows/temp").ok).toBe(false);
        expect(validateSaveDirPath("C:\\Windows").reason).toContain("protected system location");
        expect(validateSaveDirPath("C:\\Windows").reason).toContain("C:\\Windows");
    });

    test("denies Program Files, Program Files (x86), ProgramData and short-name aliases", () => {
        expect(validateSaveDirPath("C:\\Program Files\\SomeApp").ok).toBe(false);
        expect(validateSaveDirPath("C:\\Program Files (x86)").ok).toBe(false);
        expect(validateSaveDirPath("C:\\ProgramData\\SomeApp").ok).toBe(false);
        expect(validateSaveDirPath("C:\\PROGRA~1\\SomeApp").ok).toBe(false);
        expect(validateSaveDirPath("C:\\progra~2\\SomeApp").ok).toBe(false);
    });

    test("denies the per-user Startup folder incl. subfolders, not lookalike names", () => {
        const startup = "C:\\Users\\me\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup";
        expect(validateSaveDirPath(startup).ok).toBe(false);
        expect(validateSaveDirPath(startup + "\\evil.vbs").ok).toBe(false);
        expect(validateSaveDirPath(startup).reason).toContain("Startup folder");
        expect(validateSaveDirPath(startup + "2").ok).toBe(true);
    });

    test("closes the trailing-dot/space segment trick (Win32 strips them per segment)", () => {
        expect(validateSaveDirPath("C:\\Windows \\evil").ok).toBe(false);
        expect(validateSaveDirPath("C:\\Program Files.\\app").ok).toBe(false);
    });

    test("near-miss names and user-writable locations stay allowed", () => {
        expect(validateSaveDirPath("C:\\WindowsOld\\x").ok).toBe(true);
        expect(validateSaveDirPath("C:\\WindowsApps").ok).toBe(true);
        expect(validateSaveDirPath("C:\\Users\\me\\Downloads").ok).toBe(true);
        expect(validateSaveDirPath("C:\\Users\\me\\AppData\\Local\\MyApp\\dl").ok).toBe(true);
        expect(validateSaveDirPath("D:\\Media").ok).toBe(true);
    });
});
