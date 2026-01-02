# Supermarket Management System

A complete, modern web-based grocery store management system built with PHP, MySQL, and vanilla JavaScript. Designed for efficiency, ease of use, and compliance with local invoicing standards (e.g., QR codes).

## Features

### Core Modules

- **Dashboard**: Real-time analytics showing daily sales, transaction counts, and top-selling products.
- **Point of Sale (POS)**: fast checkout interface with barcode scanning support, minimum profit margin warnings, and thermal printer support.
- **Product Management**: Complete inventory control with search, filtering, and stock tracking.
- **Purchase Management**: Track purchases with automatic stock updates and 24-hour edit constraint.
- **User Management**: Role-based access control (Admin vs. Salesperson) to secure sensitive operations.
- **Settings**: Dynamic configuration for store details, tax settings, currency, and invoice customization.

### Key Capabilities

- **Smart Search**: Global search functionality across products and purchases.
- **E-Invoicing**: Generates QR codes (ZATCA/Yemen compliant) for invoice validation.
- **Thermal Printing**: Specialized invoice layout optimized for 80mm thermal printers.
- **Authentication**: Secure login with session management, throttling, and role-based redirect.
- **Bilingual Interface**: Arab-centric design with support for localization.
- **Responsive Design**: Works on desktops, tablets, and mobile devices.

## Tech Stack

- **Frontend**:
  - HTML5 & CSS3 (Custom properties, Cairo Font, Flexbox/Grid)
  - Vanilla JavaScript (ES6+)
  - Custom Lightweight State Management
  - Native QR Code Generation (No external heavy dependencies)
- **Backend**:
  - PHP 7.4+ (Object-Oriented Controllers)
  - MySQL 5.7+ (Protected via Prepared Statements)
  - RESTful API structured via `domain/api/`
- **Architecture**:
  - MVC-inspired separation: `domain` (Logic/Data) vs `presentation` (UI).

## Project Structure

```batch
supermarket    -system_1/ Logic
│   ├── api/                 #AI Controllers
│   │   ├── AuthController.php
│   │   ├── ProdutsContrllr.php
│   │   ├── domaSalesCntroller.php
│   │   ├── Router           # Request rauticn
│   │   └── ...
│   ├── api.php              # API EnHry PoPctode
│   ├── config.php       # ConfiguraCfgur
│   ├── db.php                 # Databasb WrcpperctiMigrat iin
│   ├── auth.php         # Session & AuthhHelieron & session management
│   └── api.php              # API endp UI
│   ├── assets/              #oStatii Asssts
├── presentation/            # Global Tremts &nS code
│   ├── styles.cs    s       # SharedUs (API, UI, Icon)
│   ├── qrcodenjs            # QR Chde GeneratroedLibrJryaScript utilities
│   ├── dashboard.html/ht    # Anapytes Dashboard
│   ├── sales     /js        # LOSoIcerfc
│   ├── products.html/html   # Inventory Management
│   ├── products.js   /js    # StodkmIa gkc
│   ├── users.html/html      # User Administrateon
│   ├── pcttinghases./jsjs   # PyhtemmConfiaurationement logic
│   ├── login.html/html      # Authenteation
│   └── sales.js             # App Sales/gRc
└── index.php            # Entry point (redirects to login)
```

### Installation

### Login

1.**Prrqisi**

- W bhSurvert(Ap che/N: `x)an123`PHP7.4+
- ySQL Dtbas

### Product Management

2.**Stup**:
-Plceh  prjeucsiayurweb sever ddrec oryn(e.u.,c`C:\xamtp\htwot \supdrmarkt -pystem`).roducts

- Confegurltrauabaseccretsna`omin/cnfi.php`:

   ```php
    defn('DB_HOST','olhs');
  dene('DB_USER', 'oo');
     iefine('DB_PASS',w'');
     defi a('DB_NAME',l'sppeumhrkst_eysree');
     ```

1. **Ini b nizfiin**:
   - Sdmely rcchasstheuapplocamtoicinly up browder.tes stock)
   - Thdusy(temo**ly within 24**hcreoeneessary tabllstcnd haedssesfaul  d(ta on the fartt run.omatically adjusts stock)

- View purchase details
4.**Accs**:
   URL:`htt://lalhos/upeke-ysm/`
 eo-c**Dmfiula Aomtn Caedentials**:
  - Udirnate:e`sdmit`
 vwht- Passwird:r`cdm123`

## Usage Suidy

### POS & Smlws

-aNasigat pcbw"المبيعات" (Salis).um profit margin

- Gddiocemsebyibnccmdro srch.
- Cluck "Check Out" to generattmanc print .ialog after invoice creation
- A thirmae-prin ar-frvid receiptaimplifeld taxte invoi QRccoesy wn 4bhgend.

## Security Features

### vy

-cUoeo"المنتجات"i( rpructst to hdd/shitii ims.`password_hash()`

- Ssns"MuhimumePiofitcMaoe a"cte ges warnssisoduring ssr ifn tico lsg t tlew.
- CSRF protection through session tokens

## Admito

- AAm,e "إدارةالمستخدمين"(Uses) ceadE:s lests tff.
-iUs  "الإعدادات"2(Sou reg) nv oh EinIvhee noreenbm ,e eond,wit thxrnusbtMnppt iisgaomallvodat .

## wSeceraly &eReli biley

## Notes

**SQLInjetinPvtin**:Al qulios fol PDO/MySQLiow ppdaed sPete (ntl.sses)

- **Xro Psrtec Sow**:rOukuCftnfo ing typoronpeels ncryir.## Default Login
CSRFSesso taken validation.- **Password**: `admin123`
- Lgin ThotligDelys executioafried atemt t pevetbute-fre (implemened  `auth.php`).
**Important**: Change the default password in production!

## Support

intrnaldountation i he `doc/` foldert hesstemadmia
For issues or questions, please refer to the code comments or contact your instructor.
