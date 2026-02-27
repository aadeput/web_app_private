/**
 * GEOACCESS INDONESIA | PRIVATE TRAINING SYSTEM
 * Version: 2.9 (Fonnte Optimized & Personal WhatsApp Template)
 */

const FONNTE_TOKEN = "rUMd2A632j5rBeAxRmaB";

function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Geoaccess Indonesia | Private Training')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Memeriksa apakah email sudah terdaftar dan mengambil data terkait
 */
function cekEmailRegistrasi(emailInput) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const emailLower = emailInput.toLowerCase().trim();
  const data = ss.getSheetByName("Form Responses 1").getDataRange().getValues();
  
  const row = data.find(r => r[5] && r[5].toString().toLowerCase().trim() === emailLower);
  if (!row) return null;

  const tutorNama = row[1];
  const noHpPeserta = row[6]; 
  const linkZoom = row[15];   

  if (!tutorNama || tutorNama.toString().trim() === "") {
    return { status: "no_tutor" };
  }

  const dataTutor = ss.getSheetByName("Sheet1").getDataRange().getValues();
  const tutorRow = dataTutor.find(r => r[0] === tutorNama);
  
  let calId = null;
  let fotoUrl = ""; 
  let tentangTutor = ""; 

  if (tutorRow) {
    // --- REVISI: LOGIKA TENTANG TUTOR PROFESIONAL ---
    let spesifikasi = tutorRow[3] ? tutorRow[3].toString().trim() : "";
    tentangTutor = spesifikasi !== "" 
      ? "Profesional tutor dengan spesifikasi <b>" + spesifikasi + "</b>." 
      : "Profesional tutor di Geoaccess Indonesia.";
    // -----------------------------------------------

    let rawUrl = tutorRow[2] ? tutorRow[2].toString().trim() : "";
    if (rawUrl.includes("drive.google.com")) {
      let match = rawUrl.match(/[-\w]{25,}/);
      if (match) fotoUrl = "https://drive.google.com/thumbnail?id=" + match[0] + "&sz=w500";
    } else {
      fotoUrl = rawUrl;
    }

    if (tutorRow[1]) {
      const url = tutorRow[1];
      const match = url.match(/[?&]cid=([^&]+)/);
      if (match) {
        calId = decodeURIComponent(match[1]);
        if (!calId.includes('@')) {
          try { calId = Utilities.newBlob(Utilities.base64Decode(calId)).getDataAsString(); } catch(e) {}
        }
      }
    }
  }

  return { 
    status: "success", 
    tutor: tutorNama, 
    tutorCalendar: calId,
    tutorFoto: fotoUrl, 
    tutorTentang: tentangTutor,
    whatsapp: noHpPeserta,
    zoom: linkZoom 
  };
}

/**
 * Mengambil tanggal yang sudah di-block (Full Day)
 */
function getDisabledDates(tutorCalendar, month, year) {
  try {
    if (!tutorCalendar) return [];
    const calendar = CalendarApp.getCalendarById(tutorCalendar);
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);
    const events = calendar.getEvents(startDate, endDate);
    const disabledDates = new Set();
    events.forEach(e => {
      if (e.isAllDayEvent()) {
        let current = new Date(e.getStartTime());
        const end = new Date(e.getEndTime());
        while (current < end) {
          disabledDates.add(Utilities.formatDate(current, "GMT+7", "yyyy-MM-dd"));
          current.setDate(current.getDate() + 1);
        }
      }
    });
    return Array.from(disabledDates);
  } catch (e) { return []; }
}

/**
 * Mengambil jam yang sudah terisi (Busy)
 */
function getBusyTimes(tutorCalendar, dateStr) {
  try {
    if (!tutorCalendar) return [];
    const calendar = CalendarApp.getCalendarById(tutorCalendar);
    const selectedDate = new Date(dateStr);
    const startOfDay = new Date(selectedDate.setHours(0,0,0,0));
    const endOfDay = new Date(selectedDate.setHours(23,59,59,999));
    return calendar.getEvents(startOfDay, endOfDay)
      .filter(e => !e.isAllDayEvent()) 
      .map(e => ({
        start: e.getStartTime().getTime(),
        end: e.getEndTime().getTime()
      }));
  } catch (e) { return []; }
}

/**
 * PROSES UTAMA: Insert Kalender & Kirim WhatsApp
 */
function prosesPendaftaran(nama, email, tutorCalendar, summary, topik, noHp, linkZoom, tutorNamaData) {
  try {
    const items = summary.split(" | ");
    const zoomText = (linkZoom && linkZoom.toString().includes('http')) ? linkZoom.toString().trim() : "Akan dikirimkan menyusul";
    
    const namaTutor = tutorNamaData || "Tutor Geoaccess Indonesia";

    items.forEach(item => {
      const [d, tPart] = item.split(" @ ");
      const tRange = tPart.split(" - ")[0]; 
      const start = new Date(d + "T" + tRange.replace('.', ':') + ":00");
      const end = new Date(start.getTime() + (3 * 60 * 60 * 1000));
      
      // 1. PROSES KALENDER
      const resource = {
        summary: `Private: ${topik} - ${nama}`,
        description: `📚 Topik: ${topik}\n👨‍🏫 Tutor: ${namaTutor}\n💻 LINK ZOOM: ${zoomText}`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: [{ email: email }]
      };
      
      try {
        Calendar.Events.insert(resource, tutorCalendar, { sendUpdates: "all" });
      } catch (errCal) {
        console.error("Gagal insert kalender: " + errCal.message);
      }
      
      // 2. PROSES WHATSAPP
      if (noHp) {
        let cleanPhone = noHp.toString().replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '62' + cleanPhone.slice(1);
        } else if (cleanPhone.startsWith('8')) {
          cleanPhone = '62' + cleanPhone;
        }
        
        const zoomLinkFinal = zoomText.toString().trim();

        const pesan = `Halo Kak ${nama} 👋🏻\n\n` +
                      `Booking jadwal training kak *${nama}* untuk sesi *${topik}* sudah berhasil dikonfirmasi ya! ✅\n\n` +
                      `👨🏻‍🏫 *Tutor:* ${namaTutor}\n` +
                      `📅 *Jadwal:* ${d}, ${tRange} WIB\n` +
                      `💻 *Link Zoom:* ${zoomLinkFinal}\n\n` +
                      `Jika ingin mengubah jadwal mohon untuk menghubungi admin yaa!\n` +
                      `Admin Geoaccess Indonesia: https://wa.me/6285747014727\n\n` +
                      `Salam hangat,\n` +
                      `Geoaccess Indonesia`;
        
        const options = {
          method: 'post',
          headers: { 'Authorization': FONNTE_TOKEN.trim() },
          payload: {
            'target': cleanPhone,
            'message': pesan,
            'countryCode': '62',
            'delay': '2'
          },
          muteHttpExceptions: true
        };

        try {
          const response = UrlFetchApp.fetch('https://api.fonnte.com/send', options);
          console.log("Log Fonnte (" + cleanPhone + "): " + response.getContentText());
        } catch (errWA) {
          console.error("Gagal koneksi WA: " + errWA.message);
        }
      }
    });
    
    return true;
  } catch (e) { 
    console.error("Kesalahan Fatal: " + e.message);
    return false;
  }
}