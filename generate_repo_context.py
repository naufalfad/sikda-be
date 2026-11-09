#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
SIKDA BACKEND REPOSITORY CONTEXT GENERATOR
================================================================================
Script ini mengekstrak seluruh arsitektur, skema database, routes, controller,
service, dan konfigurasi SIKDA Backend ke dalam satu file .txt yang terstruktur.
File .txt hasil generate ini dirancang agar LLM / AI (ChatGPT, Claude, Gemini, dll)
dapat langsung memahami proses aplikasi, relasi database, dan alur bisnis backend.

Penggunaan:
    python generate_repo_context.py
    atau
    python generate_repo_context.py --output custom_name.txt
================================================================================
"""

import os
import sys
import json
import time
from datetime import datetime
from pathlib import Path

# Proteksi encoding UTF-8 untuk terminal Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# ─────────────────────────────────────────────────────────────────────────────
# KONFIGURASI FILTER & PENGECUALIAN
# ─────────────────────────────────────────────────────────────────────────────

# Folder yang diabaikan (folder dependensi, build, upload, binary, cache, session)
IGNORE_DIRS = {
    'node_modules',
    '.git',
    '.vscode',
    '.idea',
    '__pycache__',
    'coverage',
    'logs',
    'dist',
    'build',
    '.turbo',
    'scratch',
    'uploads',        # Berisi file foto/dokumen upload dinamis
    'whatsapp_auth',  # Berisi session token WA Baileys (kredensial biner)
    'tmp',
    'temp',
}

# Ekstensi file biner / media / cache yang diabaikan
IGNORE_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.svg',
    '.mp4', '.mp3', '.wav', '.ogg', '.m4a',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.exe', '.bin', '.dll', '.so', '.dylib',
    '.db', '.sqlite', '.sqlite3',
    '.pyc', '.pyo', '.pyd',
    '.map',
}

# File spesifik yang diabaikan
IGNORE_FILENAMES = {
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.DS_Store',
    'Thumbs.db',
    'generate_repo_context.py',
    'sikda-be.txt',
}

# Batas ukuran per file (default 350 KB) untuk mencegah file dump data raksasa masuk ke context
MAX_FILE_SIZE_BYTES = 350 * 1024


def is_binary_file(filepath):
    """Mendeteksi apakah file adalah biner (misal file compiled atau image)."""
    try:
        with open(filepath, 'rb') as f:
            chunk = f.read(1024)
            if b'\x00' in chunk:
                return True
        return False
    except Exception:
        return True


def mask_env_content(content):
    """
    Menyamarkan nilai rahasia di file .env agar aman dibagikan ke AI,
    namun tetap menampilkan variabel apa saja yang dibutuhkan oleh sistem.
    """
    masked_lines = []
    for line in content.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith('#'):
            masked_lines.append(line)
            continue
        if '=' in line:
            key, val = line.split('=', 1)
            key = key.strip()
            val = val.strip()
            # Pertahankan variabel publik/port/mode, samarkan sisanya
            if any(safe_key in key.upper() for safe_key in ['PORT', 'NODE_ENV', 'HOST', 'APP_NAME', 'TZ']):
                masked_lines.append(f"{key}={val}")
            else:
                masked_lines.append(f"{key}=***MASKED_FOR_AI_SECURITY***")
        else:
            masked_lines.append(line)
    return "\n".join(masked_lines)


def get_priority_score(filepath_rel):
    """
    Memberikan skor prioritas pengurutan file agar AI membaca konfigurasi
    dan skema data terlebih dahulu sebelum membaca logika bisnis dan utilitas.
    (Skor lebih kecil = diletakkan lebih awal di file txt).
    """
    path_str = filepath_rel.replace('\\', '/').lower()
    
    if path_str == 'package.json':
        return 10
    if path_str == '.env.example' or path_str == '.env':
        return 15
    if 'schema.prisma' in path_str:
        return 20  # Sangat penting: skema database Prisma
    if path_str.startswith('src/server.js') or path_str.startswith('src/app.js') or path_str.startswith('src/index.js'):
        return 30
    if path_str.startswith('src/config/'):
        return 40
    if path_str.startswith('src/middlewares/'):
        return 50
    if path_str.startswith('src/routes/'):
        return 60
    if path_str.startswith('src/controllers/'):
        return 70
    if path_str.startswith('src/services/'):
        return 80
    if path_str.startswith('src/utils/'):
        return 90
    if path_str.startswith('prisma/seed'):
        return 100
    if path_str.startswith('scripts/'):
        return 110
    return 200


def build_ascii_tree(dir_path, collected_files):
    """Membuat representasi visual struktur direktori pohon ASCII."""
    tree_lines = []
    
    # Kumpulkan seluruh path relatif yang valid
    valid_paths = set(collected_files)
    
    # Buat nested dictionary
    tree = {}
    for path in sorted(valid_paths):
        parts = Path(path).parts
        current = tree
        for part in parts:
            current = current.setdefault(part, {})

    def render_tree(sub_tree, prefix=""):
        items = list(sub_tree.items())
        # Pisahkan direktori dan file
        items.sort(key=lambda x: (len(x[1]) == 0, x[0].lower()))
        
        count = len(items)
        for i, (name, children) in enumerate(items):
            is_last = (i == count - 1)
            connector = "└── " if is_last else "├── "
            icon = "📁 " if children else "📄 "
            tree_lines.append(f"{prefix}{connector}{icon}{name}")
            
            if children:
                extension = "    " if is_last else "│   "
                render_tree(children, prefix + extension)

    render_tree(tree)
    return "\n".join(tree_lines)


def parse_package_info(root_dir):
    """Membaca ringkasan dependencies dari package.json."""
    pkg_path = os.path.join(root_dir, 'package.json')
    if not os.path.exists(pkg_path):
        return {}
    try:
        with open(pkg_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return {
                'name': data.get('name', 'SIKDA Backend'),
                'version': data.get('version', '1.0.0'),
                'dependencies': list(data.get('dependencies', {}).keys()),
                'devDependencies': list(data.get('devDependencies', {}).keys()),
                'scripts': data.get('scripts', {}),
            }
    except Exception:
        return {}


def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Penentuan nama file output (default: repo_context_backend.txt)
    output_filename = "repo_context_backend.txt"
    if len(sys.argv) > 1:
        if sys.argv[1] in ['--output', '-o'] and len(sys.argv) > 2:
            output_filename = sys.argv[2]
        elif not sys.argv[1].startswith('-'):
            output_filename = sys.argv[1]

    output_path = os.path.join(root_dir, output_filename)

    start_time = time.time()
    print("=" * 70)
    print("🚀 SIKDA BACKEND REPOSITORY CONTEXT GENERATOR")
    print("=" * 70)
    print(f"📂 Direktori Root  : {root_dir}")
    print(f"📄 File Target     : {output_path}")
    print("🔍 Memindai seluruh berkas repositori...")

    # Langkah 1: Kumpulkan seluruh berkas yang relevan
    collected_files = []
    skipped_count = 0
    
    for current_root, dirs, files in os.walk(root_dir):
        # Filter direktori yang diabaikan secara in-place
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]
        
        for file in files:
            # Lewati file output sendiri dan file generator
            if file == output_filename or file.startswith('repo_context_') or file in IGNORE_FILENAMES:
                continue

            ext = os.path.splitext(file)[1].lower()
            if ext in IGNORE_EXTENSIONS:
                skipped_count += 1
                continue

            full_path = os.path.join(current_root, file)
            rel_path = os.path.relpath(full_path, root_dir)

            # Lewati file biner
            if is_binary_file(full_path):
                skipped_count += 1
                continue

            collected_files.append(rel_path)

    # Urutkan berdasarkan prioritas arsitektur
    collected_files.sort(key=lambda p: (get_priority_score(p), p.lower()))

    total_files = len(collected_files)
    print(f"✅ Ditemukan {total_files} berkas relevan ({skipped_count} berkas non-kode diabaikan).")
    print("📝 Menulis struktur direktori dan isi file ke dokumen konteks...")

    # Informasi package.json
    pkg_info = parse_package_info(root_dir)

    # Langkah 2: Bangun pohon ASCII
    ascii_tree = build_ascii_tree(root_dir, collected_files)

    # Langkah 3: Tulis ke file output
    total_lines_written = 0
    with open(output_path, 'w', encoding='utf-8', errors='replace') as out:
        # HEADER DOKUMEN UNTUK AI
        out.write("=" * 80 + "\n")
        out.write("SIKDA BACKEND - COMPLETE REPOSITORY CONTEXT DUMP FOR AI\n")
        out.write("=" * 80 + "\n")
        out.write(f"Generated at       : {datetime.now().strftime('%Y-%m-%d %H:%M:%S WIB')}\n")
        out.write(f"Repository Root    : {root_dir}\n")
        out.write(f"Total Source Files : {total_files}\n")
        out.write(f"Project Name       : {pkg_info.get('name', 'SIKDA Backend')}\n")
        out.write(f"Project Version    : {pkg_info.get('version', '1.0.0')}\n")
        out.write("\n")
        out.write("PETUNJUK UNTUK MODEL AI / ASSISTANT:\n")
        out.write("------------------------------------\n")
        out.write("Dokumen ini memuat seluruh kode sumber, konfigurasi, skema database, dan arsitektur\n")
        out.write("backend SIKDA (Sistem Informasi Kesehatan Daerah). Dokumen ini disusun secara terstruktur:\n")
        out.write("1. Ringkasan dependensi dan pustaka utama (package.json).\n")
        out.write("2. Struktur pohon direktori lengkap repositori.\n")
        out.write("3. Skema database PostgreSQL (Prisma ORM: prisma/schema.prisma).\n")
        out.write("4. Kode server, middleware, routes, controller, service, dan fhir-mapper SATUSEHAT.\n")
        out.write("Gunakan dokumen ini untuk menganalisis alur bisnis klinis, integrasi BPJS/SATUSEHAT,\n")
        out.write("pembuatan endpoint baru, maupun perbaikan bug pada backend.\n")
        out.write("=" * 80 + "\n\n")

        # BAGIAN 1: DEPENDENCIES & SCRIPTS
        if pkg_info:
            out.write("=" * 80 + "\n")
            out.write("BAGIAN 1: INFORMASI DEPENDENSI & RUNTIME\n")
            out.write("=" * 80 + "\n")
            out.write("DEPENDENSI UTAMA:\n")
            for dep in pkg_info.get('dependencies', []):
                out.write(f"  - {dep}\n")
            out.write("\nDEV DEPENDENCIES:\n")
            for dep in pkg_info.get('devDependencies', []):
                out.write(f"  - {dep}\n")
            out.write("\nNPM SCRIPTS:\n")
            for script_name, cmd in pkg_info.get('scripts', {}).items():
                out.write(f"  - npm run {script_name} => {cmd}\n")
            out.write("\n\n")

        # BAGIAN 2: STRUKTUR POHON DIREKTORI
        out.write("=" * 80 + "\n")
        out.write("BAGIAN 2: STRUKTUR POHON DIREKTORI REPOSITORI\n")
        out.write("=" * 80 + "\n")
        out.write(f"📁 {os.path.basename(root_dir)}\n")
        out.write(ascii_tree)
        out.write("\n\n")

        # BAGIAN 3: KONTEN KODE SUMBER LENGKAP
        out.write("=" * 80 + "\n")
        out.write("BAGIAN 3: KODE SUMBER BERKAS REPOSITORI LENGKAP\n")
        out.write("=" * 80 + "\n\n")

        for idx, rel_path in enumerate(collected_files, 1):
            full_path = os.path.join(root_dir, rel_path)
            file_size = os.path.getsize(full_path)
            ext = os.path.splitext(rel_path)[1].lower() or '.txt'

            out.write("=" * 80 + "\n")
            out.write(f"FILE [{idx}/{total_files}]: {rel_path.replace(os.sep, '/')}\n")
            out.write(f"SIZE: {file_size:,} bytes | EXT: {ext}\n")
            out.write("=" * 80 + "\n")

            # Cek jika file melebihi batas ukuran
            if file_size > MAX_FILE_SIZE_BYTES:
                out.write(f"[PERINGATAN: File berukuran {file_size / 1024:.1f} KB melebihi batas {MAX_FILE_SIZE_BYTES / 1024:.0f} KB. Isi file dilewati untuk efisiensi context window AI.]\n\n")
                continue

            try:
                with open(full_path, 'r', encoding='utf-8', errors='replace') as infile:
                    content = infile.read()

                # Jika file .env, samarkan kredensial rahasia
                if os.path.basename(rel_path).startswith('.env'):
                    content = mask_env_content(content)

                out.write(content)
                if not content.endswith('\n'):
                    out.write('\n')
                out.write("\n")

                total_lines_written += len(content.splitlines())
            except Exception as e:
                out.write(f"[ERROR membaca berkas {rel_path}: {str(e)}]\n\n")

            # Cetak progress setiap 25 file
            if idx % 25 == 0 or idx == total_files:
                print(f"  -> Diproses: {idx}/{total_files} berkas...")

    elapsed = time.time() - start_time
    output_size_mb = os.path.getsize(output_path) / (1024 * 1024)

    print("=" * 70)
    print("🎉 GENERASI KONTEKS REPOSITORI BERHASIL!")
    print("=" * 70)
    print(f"📄 File Output   : {output_path}")
    print(f"📊 Total Berkas  : {total_files} berkas")
    print(f"📝 Total Baris   : ~{total_lines_written:,} baris kode")
    print(f"💾 Ukuran Berkas : {output_size_mb:.2f} MB")
    print(f"⏱️ Waktu Eksekusi: {elapsed:.2f} detik")
    print("=" * 70)
    print("💡 TIPS UNTUK MENGGUNAKAN FILE INI:")
    print("1. Anda dapat meng-upload file txt ini ke ChatGPT Plus, Claude, atau Google AI Studio.")
    print("2. Tanyakan apa pun tentang backend SIKDA, seperti:")
    print("   - 'Jelaskan alur data dari pendaftaran sampai kasir di SIKDA.'")
    print("   - 'Tolong buatkan endpoint baru untuk riwayat resep pasien.'")
    print("   - 'Analisis potensi bottleneck query pada modul rawatJalan.service.js.'")
    print("=" * 70)


if __name__ == '__main__':
    main()
