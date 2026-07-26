import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { patientName, patientLang, primaryDiagnosis } = await request.json();

    const emergencyPayload = {
      sosTicketId: `SOS-108-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'AMBULANCE_EN_ROUTE',
      etaMinutes: 12,
      serviceProvider: 'National Health Mission 108 Emergency Fleet',
      patientInfo: {
        name: patientName,
        suspectedCondition: primaryDiagnosis,
      },
      firstAidInstructions: [
        'Keep the patient sitting upright in a well-ventilated area.',
        'Loosen tight clothing around the neck and chest.',
        'Monitor pulse and keep emergency contacts ready.',
        'Do not offer solid foods or heavy liquids until paramedics arrive.',
      ],
    };

    console.warn('[Emergency-Agent] 108 SOS TRIGGERED:', emergencyPayload);

    return NextResponse.json({
      success: true,
      emergency: emergencyPayload,
    });
  } catch (error: any) {
    console.error('Emergency-Agent Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}