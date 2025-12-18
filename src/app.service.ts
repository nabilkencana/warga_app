import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AppService {
  getDownloadPage(): string {
    // Ambil info real dari APK
    const apkPath = path.join(process.cwd(), 'public/download/app-release.apk');
    let fileSizeMB = '80'; // Default 80MB
    let fileSizeBytes = '83886080'; // 80MB in bytes

    if (fs.existsSync(apkPath)) {
      const stats = fs.statSync(apkPath);
      fileSizeBytes = stats.size.toString();
      fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    }

    

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Download Aplikasi Warga Kita</title>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
          <style>
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              }
              
              body {
                  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                  min-height: 100vh;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  padding: 20px;
              }
              
              .container {
                  background: white;
                  border-radius: 25px;
                  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
                  overflow: hidden;
                  max-width: 800px;
                  width: 100%;
                  display: flex;
                  min-height: 500px;
              }
              
              .left-panel {
                  flex: 1;
                  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
                  padding: 40px 30px;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  color: white;
              }
              
              .right-panel {
                  flex: 1.2;
                  padding: 40px;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
              }
              
              .logo {
                  width: 120px;
                  height: 120px;
                  background: white;
                  border-radius: 25px;
                  margin: 0 auto 25px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #1e3a8a;
                  font-size: 50px;
                  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
              }
              
              h1 {
                  color: white;
                  margin-bottom: 15px;
                  font-size: 32px;
                  text-align: center;
              }
              
              .tagline {
                  color: rgba(255, 255, 255, 0.9);
                  text-align: center;
                  font-size: 18px;
                  line-height: 1.6;
                  margin-bottom: 40px;
              }
              
              .app-info {
                  text-align: center;
                  color: rgba(255, 255, 255, 0.8);
              }
              
              .app-info p {
                  margin: 5px 0;
                  font-size: 16px;
              }
              
              h2 {
                  color: #1e3a8a;
                  margin-bottom: 25px;
                  font-size: 28px;
                  text-align: center;
              }
              
              .features-grid {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 20px;
                  margin-bottom: 35px;
              }
              
              .feature-card {
                  background: #f0f7ff;
                  border-radius: 15px;
                  padding: 20px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  text-align: center;
                  transition: transform 0.3s ease;
                  border: 2px solid #e0f2fe;
              }
              
              .feature-card:hover {
                  transform: translateY(-5px);
                  box-shadow: 0 10px 20px rgba(30, 58, 138, 0.1);
              }
              
              .feature-icon {
                  width: 50px;
                  height: 50px;
                  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                  border-radius: 12px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 24px;
                  margin-bottom: 15px;
              }
              
              .feature-title {
                  color: #1e3a8a;
                  font-weight: 600;
                  font-size: 16px;
                  margin-bottom: 5px;
              }
              
              .feature-desc {
                  color: #4b5563;
                  font-size: 14px;
                  line-height: 1.4;
              }
              
              .download-section {
                  text-align: center;
              }
              
              .btn-download {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 18px 30px;
                  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                  color: white;
                  border-radius: 15px;
                  text-decoration: none;
                  font-weight: 600;
                  font-size: 18px;
                  transition: all 0.3s ease;
                  border: none;
                  cursor: pointer;
                  width: 100%;
                  max-width: 350px;
                  margin: 0 auto 15px;
                  box-shadow: 0 10px 20px rgba(30, 58, 138, 0.3);
              }
              
              .btn-download:hover {
                  transform: translateY(-3px);
                  box-shadow: 0 15px 30px rgba(30, 58, 138, 0.4);
              }
              
              .btn-download:active {
                  transform: translateY(-1px);
              }
              
              .btn-download i {
                  margin-right: 12px;
                  font-size: 24px;
              }
              
              .file-info {
                  color: #6b7280;
                  font-size: 14px;
                  margin-top: 10px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 10px;
              }
              
              .file-size {
                  background: #e0f2fe;
                  padding: 4px 12px;
                  border-radius: 20px;
                  font-weight: 600;
                  color: #1e3a8a;
              }
              
              .checksum {
                  font-family: monospace;
                  font-size: 12px;
                  color: #6b7280;
                  background: #f3f4f6;
                  padding: 8px;
                  border-radius: 8px;
                  margin-top: 10px;
                  word-break: break-all;
              }
              
              .warning {
                  color: #ef4444;
                  font-size: 13px;
                  margin-top: 15px;
                  padding: 10px;
                  background: #fef2f2;
                  border-radius: 8px;
                  border-left: 4px solid #ef4444;
              }
              
              .success-badge {
                  display: inline-block;
                  background: #10b981;
                  color: white;
                  padding: 4px 12px;
                  border-radius: 20px;
                  font-size: 12px;
                  font-weight: 600;
                  margin-left: 10px;
              }
              
              @media (max-width: 768px) {
                  .container {
                      flex-direction: column;
                      max-width: 400px;
                  }
                  
                  .left-panel {
                      padding: 30px 20px;
                  }
                  
                  .right-panel {
                      padding: 30px 20px;
                  }
                  
                  .features-grid {
                      grid-template-columns: 1fr;
                  }
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="left-panel">
                  <div class="logo">
                      <i class="fas fa-users"></i>
                  </div>
                  
                  <h1>Warga Kita</h1>
                  <p class="tagline">Aplikasi komunitas digital untuk memudahkan kehidupan bertetangga dan berinteraksi sosial</p>
                  
                  <div class="app-info">
                      <p><i class="fas fa-mobile-alt"></i> Khusus Android</p>
                      <p><i class="fas fa-download"></i> Ukuran: ${fileSizeMB} MB</p>
                      <p><i class="fas fa-shield-alt"></i> Versi 3.0.1</p>
                      <p><i class="fas fa-check-circle"></i> APK Original</p>
                  </div>
              </div>
              
              <div class="right-panel">
                  <h2>Fitur Utama</h2>
                  
                  <div class="features-grid">
                      <div class="feature-card">
                          <div class="feature-icon">
                              <i class="fas fa-bullhorn"></i>
                          </div>
                          <div class="feature-title">Pengumuman Terkini</div>
                          <div class="feature-desc">Info penting seputar lingkungan secara real-time</div>
                      </div>
                      
                      <div class="feature-card">
                          <div class="feature-icon">
                              <i class="fas fa-exclamation-triangle"></i>
                          </div>
                          <div class="feature-title">SOS Emergency</div>
                          <div class="feature-desc">Kontak darurat dan bantuan cepat saat keadaan mendesak</div>
                      </div>
                      
                      <div class="feature-card">
                          <div class="feature-icon">
                              <i class="fas fa-clipboard-list"></i>
                          </div>
                          <div class="feature-title">Laporan Fasilitas</div>
                          <div class="feature-desc">Laporkan kerusakan fasilitas umum dengan mudah</div>
                      </div>
                      
                      <div class="feature-card">
                          <div class="feature-icon">
                              <i class="fas fa-wallet"></i>
                          </div>
                          <div class="feature-title">Dana Iuran</div>
                          <div class="feature-desc">Kelola iuran warga secara transparan dan digital</div>
                      </div>
                  </div>
                  
                  <div class="download-section">
                      <a href="/download/app-release.apk" class="btn-download" download="app-release.apk">
                          <i class="fab fa-android"></i>
                          DOWNLOAD APK (${fileSizeMB} MB)
                      </a>
                      
                      <div class="file-info">
                          <i class="fas fa-info-circle"></i>
                          File APK langsung 
                          <span class="file-size">${fileSizeMB} MB</span>
                          • Tidak melalui Play Store
                      </div>
                      
                      <div class="warning">
                          <i class="fas fa-exclamation-circle"></i>
                          Pastikan Anda mengizinkan instalasi dari sumber tidak dikenal di pengaturan Android
                      </div>
                  </div>
              </div>
          </div>
          
          <script>
              // Menangani klik tombol download
              document.querySelector('.btn-download').addEventListener('click', function(e) {
                  // Tampilkan progress bar
                  const progressHtml = \`
                      <div style="
                          position: fixed;
                          top: 0;
                          left: 0;
                          width: 100%;
                          height: 100%;
                          background: rgba(0,0,0,0.8);
                          display: flex;
                          flex-direction: column;
                          justify-content: center;
                          align-items: center;
                          z-index: 9999;
                          color: white;
                      ">
                          <i class="fas fa-download" style="font-size: 48px; margin-bottom: 20px;"></i>
                          <h2 style="margin-bottom: 20px;">Mengunduh APK (${fileSizeMB} MB)</h2>
                          <div style="width: 300px; height: 20px; background: #333; border-radius: 10px; overflow: hidden;">
                              <div id="progressBar" style="width: 0%; height: 100%; background: #3b82f6; transition: width 0.3s;"></div>
                          </div>
                          <p id="progressText" style="margin-top: 10px;">Menyiapkan unduhan...</p>
                          <button onclick="this.parentElement.remove()" style="margin-top: 20px; padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 5px; cursor: pointer;">
                              Batalkan
                          </button>
                      </div>
                  \`;
                  
                  document.body.insertAdjacentHTML('beforeend', progressHtml);
                  
                  // Simulasi progress
                  let progress = 0;
                  const interval = setInterval(() => {
                      progress += Math.random() * 10;
                      if (progress > 100) progress = 100;
                      
                      const progressBar = document.getElementById('progressBar');
                      const progressText = document.getElementById('progressText');
                      
                      if (progressBar && progressText) {
                          progressBar.style.width = progress + '%';
                          progressText.textContent = \`Mengunduh: \${Math.round(progress)}%\`;
                          
                          if (progress >= 100) {
                              clearInterval(interval);
                              progressText.textContent = 'Download selesai! File akan segera terbuka...';
                              setTimeout(() => {
                                  document.querySelector('[style*="position: fixed"]')?.remove();
                              }, 2000);
                          }
                      } else {
                          clearInterval(interval);
                      }
                  }, 300);
                  
                  // Lanjutkan download
                  return true;
              });
              
              // Animasi saat hover feature card
              document.querySelectorAll('.feature-card').forEach(card => {
                  card.addEventListener('mouseenter', function() {
                      this.style.transform = 'translateY(-5px)';
                  });
                  
                  card.addEventListener('mouseleave', function() {
                      this.style.transform = 'translateY(0)';
                  });
              });
              
              // Cek apakah APK tersedia
              window.addEventListener('load', function() {
                  fetch('/api/verify-apk')
                      .then(response => response.json())
                      .then(data => {
                          if (data.status === 'error') {
                              const btn = document.querySelector('.btn-download');
                              btn.style.background = '#ef4444';
                              btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> APK TIDAK TERSEDIA';
                              btn.style.cursor = 'not-allowed';
                              btn.onclick = (e) => {
                                  e.preventDefault();
                                  alert('APK belum tersedia. Silakan hubungi administrator.');
                              };
                          }
                      });
              });
          </script>
      </body>
      </html>
    `;
  }
}