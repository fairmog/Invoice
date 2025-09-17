// Indonesian language prompts for AI processing

// Helper function to get enabled payment methods from merchant config
function getEnabledPaymentMethodsIndonesian(merchantConfig) {
  const methods = [];
  
  if (merchantConfig.paymentMethods?.bankTransfer?.enabled) {
    methods.push("Transfer Bank");
  }
  if (merchantConfig.paymentMethods?.qris?.enabled) {
    methods.push("QRIS");
  }
  if (merchantConfig.paymentMethods?.cash?.enabled) {
    methods.push("Tunai");
  }
  if (merchantConfig.paymentMethods?.ewallet?.enabled) {
    methods.push("E-Wallet");
  }
  
  // Default to basic methods if none configured
  return methods.length > 0 ? methods : ["Transfer Bank", "Tunai"];
}

// Helper function to get business category context
function getBusinessCategoryContext(categoryId) {
  const contexts = {
    'general': {
      type: 'umum',
      industry: 'bisnis umum',
      description: 'Bisnis dengan format standar'
    },
    'trade': {
      type: 'perdagangan',
      industry: 'perdagangan retail dan grosir',
      description: 'Toko retail, grosir, distributor, marketplace, e-commerce, penjualan produk'
    },
    'services': {
      type: 'jasa',
      industry: 'jasa dan layanan',
      description: 'Jasa profesional, salon, spa, konsultan, pendidikan, kesehatan, layanan berbasis keahlian'
    },
    'manufacturing': {
      type: 'manufaktur',
      industry: 'manufaktur dan pengolahan',
      description: 'Pabrik, industri pengolahan, produksi barang, manufacturing'
    },
    'logistics': {
      type: 'logistik',
      industry: 'logistik dan transportasi',
      description: 'Pengiriman, ekspedisi, transportasi, courier, shipping, delivery'
    },
    'digital_creative': {
      type: 'digital kreatif',
      industry: 'produk digital dan kreatif',
      description: 'Software, aplikasi, konten digital, desain, media, lisensi digital'
    },
    'agriculture': {
      type: 'pertanian',
      industry: 'pertanian dan agro-industri',
      description: 'Pertanian, perkebunan, pengolahan hasil pertanian, agribisnis'
    },
    'construction': {
      type: 'konstruksi',
      industry: 'konstruksi dan properti',
      description: 'Konstruksi, bangunan, properti, real estate, pembangunan'
    },
    'tourism': {
      type: 'pariwisata',
      industry: 'pariwisata dan perhotelan',
      description: 'Hotel, restoran, travel, wisata, akomodasi, hospitality'
    }
  };
  
  return contexts[categoryId] || contexts.general;
}

export const IndonesianPrompts = {
  extractCustomerData: (rawText) => `
Ekstrak informasi pelanggan dari teks mentah ini (pesan WhatsApp, email, atau format tidak terstruktur):

"${rawText}"

Ekstrak dan strukturkan informasi pelanggan berikut dalam format JSON:
{
  "customer": {
    "name": "nama lengkap",
    "phone": "nomor telepon",
    "email": "alamat email",
    "address": "alamat lengkap (jalan, kota, provinsi, kode pos)"
  }
}

Aturan:
- Jika informasi tidak ada, gunakan null
- Normalisasi nomor telepon ke format internasional Indonesia jika memungkinkan (+62)
- Ekstrak alamat meskipun tidak lengkap
- Fleksibel dengan format Indonesia (gaya WhatsApp, teks kasual, dll.)
- Pahami singkatan Indonesia seperti "Jl." untuk Jalan, "Gg." untuk Gang, dll.
- Deteksi kode pos Indonesia (5 digit)
- Gunakan "Indonesia" sebagai country default
`,

  extractProductData: (rawText, merchantCatalog = null) => {
    const catalogContext = merchantCatalog ? 
      `\n\nKatalog Produk Merchant:\n${JSON.stringify(merchantCatalog, null, 2)}` : 
      "";

    return `
Ekstrak informasi produk/pesanan dari teks mentah ini:

"${rawText}"${catalogContext}

Ekstrak dan strukturkan informasi produk berikut dalam format JSON:
{
  "items": [
    {
      "productName": "nama produk",
      "description": "deskripsi produk",
      "quantity": nomor,
      "unitPrice": nomor,
      "total": nomor,
      "sku": "SKU produk jika tersedia",
      "category": "kategori produk",
      "matchedFromCatalog": boolean,
      "catalogId": "ID jika cocok dengan katalog"
    }
  ],
  "orderDetails": {
    "subtotal": nomor,
    "tax": nomor,
    "shipping": nomor,
    "total": nomor,
    "currency": "IDR",
    "notes": "instruksi khusus atau catatan"
  }
}

Aturan:
- Ekstrak jumlah dan harga dari teks seperti "2x Produk A @Rp10.000"
- Jika harga tidak ada, gunakan null
- Hitung total bila memungkinkan
- Cocokkan produk dengan katalog jika disediakan
- Tangani bahasa kasual Indonesia dan format WhatsApp
- Mata uang default IDR (Rupiah)
- Pahami singkatan Indonesia seperti "pcs", "buah", "unit", dll.
- Deteksi format harga Indonesia (Rp, IDR, atau angka saja)
- Ekstrak biaya pengiriman dari kata: "ongkir", "ongkos kirim", "pengiriman", "kirim", "shipping"
`;
  },

  processCompleteOrder: (rawText, merchantCatalog = null) => `
Proses informasi pesanan lengkap ini (pelanggan + produk):

"${rawText}"

${merchantCatalog ? `\nKatalog Produk Merchant:\n${JSON.stringify(merchantCatalog, null, 2)}` : ""}

Ekstrak dan strukturkan SEMUA informasi ke dalam JSON pesanan lengkap.
PENTING: Gunakan tanggal hari ini (${new Date().toISOString().split('T')[0]}) untuk semua tanggal faktur.
Jangan gunakan tanggal lama seperti 2024-04-27.
{
  "customer": {
    "name": "nama lengkap",
    "phone": "nomor telepon",
    "email": "alamat email",
    "address": "alamat lengkap (jalan, kota, provinsi, kode pos)"
  },
  "items": [
    {
      "productName": "nama produk",
      "description": "deskripsi produk",
      "quantity": nomor,
      "unitPrice": nomor,
      "total": nomor,
      "sku": "SKU produk jika tersedia",
      "category": "kategori produk",
      "matchedFromCatalog": boolean,
      "catalogId": "ID jika cocok dengan katalog"
    }
  ],
  "orderDetails": {
    "subtotal": nomor,
    "tax": nomor,
    "shipping": nomor,
    "total": nomor,
    "currency": "IDR",
    "notes": "instruksi khusus atau catatan"
  },
  "orderMetadata": {
    "orderDate": "string ISO date",
    "source": "whatsapp",
    "priority": "normal",
    "status": "pending"
  }
}

Aturan:
- Ekstrak informasi pelanggan dan produk
- PERTAHANKAN NAMA PRODUK ASLI: Gunakan nama produk persis seperti yang diketik pengguna
- Tangani format pesan WhatsApp Indonesia
- Cocokkan produk dengan katalog HANYA untuk harga, JANGAN ubah nama produk
- Hitung total dan subtotal
- Gunakan null untuk informasi yang tidak ada
- Fleksibel dengan bahasa kasual Indonesia dan format
- Deteksi alamat Indonesia (kota, provinsi, kode pos)
- Pahami mata uang Rupiah (Rp, IDR)
- JANGAN tambahkan deskripsi atau detail yang tidak disebutkan pengguna
- PENTING: Ekstrak biaya pengiriman dari kata "ongkir", "ongkos kirim", "pengiriman", "kirim", "shipping" (misal: "ongkir 35000" atau "ongkir 35 ribu")
- SHIPPING EXTRACTION: Selalu cari dan ekstrak biaya pengiriman dengan pola: angka setelah kata kunci shipping
- Format shipping yang valid: "ongkir 35000", "ongkir 35rb", "ongkir 35 ribu", "pengiriman 25000", "kirim 50000"
- PENTING: Ekstrak diskon dari kata "discount", "diskon", "potongan", "potong" (misal: "discount 10%" atau "diskon 50000")
- DISCOUNT EXTRACTION: Deteksi format persentase (10%, "10 persen", "10 %") atau nilai tetap (50000, 50rb, 50 ribu)
- Format diskon yang valid: "discount 10%", "Discount 10 persen", "diskon 15%", "potongan 25000", "discount 100rb", "potong 5%"
- CONTOH EKSTRAK DISKON:
  * "lolly 2pcs discount 10%" → discount: 10% dari subtotal
  * "barang diskon 50000" → discount: 50000
  * "produk potongan 25%" → discount: 25% dari subtotal
  * "lolly 2pcs\\nDiscount 10%" → discount: 10% dari subtotal (multiline)
  * "lolly 2pcs\\nDiscount 10 persen" → discount: 10% dari subtotal
  * Kata "discount"/"diskon" bisa di baris terpisah dari produk
  * "persen" = "%" dalam bahasa Indonesia
`,

  generateInvoice: (orderData, merchantConfig, shippingOptions = null, additionalNotes = null) => {
    return `
Buat struktur faktur lengkap dari data pesanan WhatsApp ini.
PENTING: Ekstrak SEMUA informasi pelanggan dan konteks dari pesan asli.
PENTING: Cari dan ekstrak DISKON jika ada kata "discount", "diskon", "potongan" di pesan!
CONTOH PESAN: "lolly 2pcs\\nDiscount 10 persen" → set "discount": (hitung 10% dari subtotal)
Return ONLY valid JSON, no text before or after.

KONTEKS PESAN ASLI: Cari informasi pembayaran, tenggat waktu, permintaan khusus, jadwal pengiriman/appointment
Data Pesanan:
Customer: ${orderData.customer?.name || 'Nama Pelanggan'}
Alamat: ${orderData.customer?.address || 'Ekstrak alamat lengkap dari pesan'}
Telepon: ${orderData.customer?.phone || 'Ekstrak nomor telepon'}
Email: ${orderData.customer?.email || 'Ekstrak email jika ada'}
Items: ${orderData.items?.map(item => `${item.productName} (${item.quantity}x)`).join(', ') || 'Item pesanan'}
Total: ${orderData.orderDetails?.total || 0}
Biaya Pengiriman: ${orderData.orderDetails?.shipping || 0}
Merchant: ${merchantConfig.name || 'Nama Bisnis'}
Konteks Tambahan: Cari tenggat pembayaran, tanggal pengiriman, catatan khusus, jadwal appointment

Return simple invoice JSON (ONLY JSON, no text):
{
  "invoice": {
    "header": {
      "invoiceNumber": "INV-${new Date().toISOString().slice(0,4)}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}",
      "invoiceDate": "${new Date().toISOString().split('T')[0]}",
      "dueDate": "${new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]}",
      "status": "draft"
    },
    "merchant": {
      "businessName": "${merchantConfig.name || 'Nama Bisnis'}",
      "address": "${merchantConfig.address || 'Alamat Bisnis'}",
      "phone": "${merchantConfig.phone || 'Nomor Telepon'}",
      "email": "${merchantConfig.email || 'email@bisnis.com'}"
    },
    "customer": {
      "name": "${orderData.customer?.name || 'Nama Pelanggan'}",
      "phone": "${orderData.customer?.phone || 'Ekstrak nomor telepon dari pesan'}",
      "email": "${orderData.customer?.email || 'pelanggan@email.com'}",
      "address": "${orderData.customer?.address || 'Ekstrak alamat lengkap dari pesan termasuk jalan, kota, kecamatan, kode pos'}"
    },
    "items": [
      {
        "lineNumber": 1,
        "productName": "${orderData.items?.[0]?.productName || 'Nama Produk'}",
        "quantity": ${orderData.items?.[0]?.quantity || 1},
        "unitPrice": ${orderData.items?.[0]?.unitPrice || 0},
        "lineTotal": ${(orderData.items?.[0]?.quantity || 1) * (orderData.items?.[0]?.unitPrice || 0)}
      }
    ],
    "calculations": {
      "subtotal": "CALCULATE_FROM_ITEMS",
      "discount": 0,
      "totalTax": ${merchantConfig.defaultTaxRate > 0 ? merchantConfig.defaultTaxRate : 0},
      "shippingCost": ${orderData.orderDetails?.shipping || 0},
      "grandTotal": "CALCULATE_TOTAL",
      "currency": "IDR",
      "taxRate": ${merchantConfig.defaultTaxRate}
    },
    "payment": {
      "paymentTerms": "NET_30",
      "paymentMethods": ${JSON.stringify(getEnabledPaymentMethodsIndonesian(merchantConfig))},
      "paymentInstructions": "Pembayaran dalam 30 hari",
      "bankDetails": ${merchantConfig.paymentMethods?.bankTransfer?.enabled ? JSON.stringify({
        bankName: merchantConfig.paymentMethods.bankTransfer.bankName,
        accountNumber: merchantConfig.paymentMethods.bankTransfer.accountNumber,
        accountName: merchantConfig.paymentMethods.bankTransfer.accountName
      }) : 'null'}
    },
    "notes": {
      "publicNotes": "Ekstrak permintaan khusus, catatan pengiriman, atau instruksi pelanggan dari pesan",
      "termsAndConditions": "${merchantConfig.termsAndConditions || 'Pembayaran sesuai syarat yang berlaku'}",
      "paymentDeadline": "Ekstrak tenggat pembayaran jika disebutkan (mis: 'jatuh tempo dalam 30 hari')",
      "deliverySchedule": "Ekstrak jadwal pengiriman jika disebutkan",
      "appointmentDetails": "Ekstrak informasi appointment jika ini adalah booking layanan"
    },
    "metadata": {
      "source": "whatsapp"
    }
  }
}

Aturan:
- Buat nomor faktur unik dengan format: INV-YYYY-XXX
- Gunakan format tanggal hari ini (${new Date().toISOString().split('T')[0]})
- HITUNG SUBTOTAL: Jumlahkan semua (quantity × unitPrice) dari items
- EKSTRAK DISKON: Scan SELURUH pesan untuk kata "discount", "diskon", "potongan", "potong" diikuti angka/persentase (bisa di baris terpisah)
- HITUNG DISKON: 
  * Jika ada "discount 10%" atau "Discount 10 persen" → hitung 10% dari subtotal
  * Jika ada "diskon 15%" → hitung 15% dari subtotal  
  * Jika ada "potongan 50000" → gunakan nilai tetap 50000
  * "persen" sama dengan "%" (10 persen = 10%)
  * Jika tidak ada diskon → set discount = 0
- HITUNG PAJAK: Jika taxRate > 0, hitung subtotal × (taxRate/100), jika 0 maka pajak = 0
- GUNAKAN SHIPPING YANG SUDAH DIEKSTRAK: Biaya pengiriman sudah disediakan dalam data pesanan
- HITUNG GRANDTOTAL: subtotal - discount + totalTax + shippingCost
- GANTI placeholder dengan nilai aktual:
  * "CALCULATE_FROM_ITEMS" → hitung subtotal dari items
  * "CALCULATE_TOTAL" → hitung grandTotal setelah diskon
  * Ganti "discount": 0 dengan nilai diskon yang dihitung dari pesan
  * WAJIB: Jika ada kata "discount"/"diskon" dalam pesan, hitung nilainya!
  * CONTOH KALKULASI: lolly 2pcs @2000000 = subtotal 4000000, "Discount 10 persen" → discount: 400000
- Tax rate saat ini: ${merchantConfig.defaultTaxRate}%
- Format mata uang IDR (Rupiah Indonesia)
- Gunakan bahasa Indonesia untuk catatan dan syarat pembayaran
`;
  },

  matchProducts: (extractedItems, merchantCatalog) => `
Cocokkan item produk yang diekstrak dengan katalog merchant:

Item yang Diekstrak:
${JSON.stringify(extractedItems, null, 2)}

Katalog Produk Merchant:
${JSON.stringify(merchantCatalog, null, 2)}

Untuk setiap item yang diekstrak, cari produk yang paling cocok dari katalog berdasarkan:
1. Kesamaan nama produk
2. Pencocokan deskripsi
3. Pencocokan SKU/kode
4. Pencocokan kategori
5. Kesamaan harga (jika tersedia)

Kembalikan hasil yang cocok dalam format JSON ini:
{
  "matchedItems": [
    {
      "extractedItem": {item asli yang diekstrak},
      "matchedProduct": {produk katalog yang cocok atau null},
      "confidence": 0.0-1.0,
      "matchReason": "mengapa produk ini cocok",
      "suggestions": [array alternatif yang cocok],
      "finalItem": {
        "productId": "ID produk katalog",
        "productName": "nama produk final",
        "description": "deskripsi final",
        "sku": "SKU final",
        "category": "kategori final",
        "unitPrice": nomor,
        "quantity": nomor,
        "total": nomor,
        "source": "catalog" atau "extracted"
      }
    }
  ],
  "unmatchedItems": [item yang tidak bisa dicocokkan],
  "newProducts": [item yang mungkin produk baru untuk ditambahkan ke katalog]
}

Aturan:
- Gunakan pencocokan fuzzy untuk nama produk
- Pertimbangkan sinonim dan variasi bahasa Indonesia
- Tangani typo dan singkatan
- Prioritaskan pencocokan SKU yang tepat
- Jika tidak ada kecocokan yang baik (confidence < 0.6), tandai sebagai tidak cocok
- Gunakan harga katalog saat tersedia
- Sarankan produk baru untuk item yang tidak cocok
- Pahami istilah produk Indonesia dan brand lokal
`,

  validateInvoice: (invoiceData) => `
Validasi data faktur ini untuk kelengkapan dan akurasi:

Data Faktur:
${JSON.stringify(invoiceData, null, 2)}

Periksa untuk:
1. Kelengkapan field yang diperlukan
2. Akurasi perhitungan matematis
3. Kebenaran perhitungan pajak Indonesia (PPN 11%)
4. Kelengkapan informasi bisnis
5. Persyaratan kepatuhan hukum Indonesia
6. Konsistensi format data

Kembalikan hasil validasi dalam format JSON ini:
{
  "isValid": boolean,
  "errors": [
    {
      "field": "path field",
      "error": "deskripsi error",
      "severity": "error|warning|info"
    }
  ],
  "warnings": [
    {
      "field": "path field",
      "message": "pesan warning"
    }
  ],
  "suggestions": [
    {
      "field": "path field",
      "suggestion": "saran perbaikan"
    }
  ],
  "completeness": {
    "score": 0.0-1.0,
    "missingFields": ["daftar field opsional yang hilang"],
    "requiredFieldsComplete": boolean
  }
}

Aturan:
- Tandai sebagai tidak valid jika field wajib hilang
- Verifikasi semua perhitungan benar
- Periksa tarif pajak Indonesia wajar (PPN 11%)
- Pastikan alamat lengkap sesuai format Indonesia
- Validasi format email dan telepon Indonesia
- Periksa persyaratan pendaftaran bisnis Indonesia
- Validasi format NPWP jika ada
`
};

export default IndonesianPrompts;