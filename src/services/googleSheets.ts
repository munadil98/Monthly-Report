import { MajlisData, Month } from '../types';

export async function fetchSheetData(month: Month): Promise<MajlisData[]> {
  const url = `/api/data?month=${month}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch data from server');
    }

    const rows = await response.json();
    
    // Filter out empty rows (where majlis name is missing)
    return rows
      .filter((row: any[]) => row[1] && row[1].trim() !== '')
      .map((row: any[]) => ({
      sl: row[0] || '',
      majlisName: row[1] || '',
      tajnidMembers: Number(row[2]) || 0,
      saffAwwal: Number(row[3]) || 0,
      saffDom: Number(row[4]) || 0,
      totalAmelaMembers: Number(row[5]) || 0,
      totalMusis: Number(row[6]) || 0,
      amelaMeeting: Number(row[7]) || 0,
      generalMeeting: Number(row[8]) || 0,
      generalMeetingAttendance: Number(row[9]) || 0,
      daiIlallahMembers: Number(row[10]) || 0,
      tablighSeminar: Number(row[11]) || 0,
      tablighDoneBy: Number(row[12]) || 0,
      tablighDoneTo: Number(row[13]) || 0,
      booksDistributed: Number(row[14]) || 0,
      baiatCount: Number(row[15]) || 0,
      quranReaders: Number(row[16]) || 0,
      quranClassMembers: Number(row[17]) || 0,
      fiveTimePrayers: Number(row[18]) || 0,
      congregationalPrayers: Number(row[19]) || 0,
      mtaConnection: Number(row[20]) || 0,
      apjMtaConnection: Number(row[21]) || 0,
      regularMtaViewers: Number(row[22]) || 0,
      regularKhutbaListeners: Number(row[23]) || 0,
      bookExam: Number(row[24]) || 0,
      bookSeminar: Number(row[25]) || 0,
      studyForumAttendance: Number(row[26]) || 0,
      nauMobainCount: Number(row[27]) || 0,
      budgetedNauMobain: Number(row[28]) || 0,
      nauMobainSeminarAttendance: Number(row[29]) || 0,
      sickAnsarMembers: Number(row[30]) || 0,
      elderlyAnsarMembers: Number(row[31]) || 0,
      foodDistribution: Number(row[32]) || 0,
      alNaserMembers: Number(row[33]) || 0,
      tahrikeJadidMembers: Number(row[34]) || 0,
      waqfeJadidMembers: Number(row[35]) || 0,
      regularExercise: Number(row[36]) || 0,
    }));
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
}
