"use client";

import { useState } from "react";
import "./globals.scss";
import BootstrapClient from "@/components/BootstrapClient";
import Sidebar from "@/components/Navbar";
import LicenseCheck from "@/components/LicenseCheck";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" />
      </head>
      <body>
        <LicenseCheck>
        <div className="app-container">
          {/* Header Móvil */}
          <header className="mobile-header d-lg-none shadow-sm px-3 d-flex align-items-center justify-content-between bg-dark">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-lightning-charge-fill text-warning fs-3"></i>
              <h5 className="mb-0 fw-bold">
                <span className="text-white">Flash</span>
                <span className="text-warning">Bank</span>
              </h5>
            </div>
            <button 
              className="btn btn-link text-warning p-0 border-0" 
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <i className="bi bi-list fs-1"></i>
            </button>
          </header>

          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
          
          <main className="main-content">
            {children}
          </main>
        </div>
        </LicenseCheck>
        <BootstrapClient />
      </body>
    </html>
  );
}
