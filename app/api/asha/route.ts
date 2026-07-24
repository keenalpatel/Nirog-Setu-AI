import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { patientName, patientLang, location, primaryDiagnosis, urgencyLevel } = await request.json();

    // Map region details based on patient language preference
    const regionalData: Record<string, any> = {
      Hindi: { workerName: 'Anita Devi (Senior ASHA)', workerPhone: '+91 98451 23091', center: 'Lucknow PHC Hub' },
      Bhojpuri: { workerName: 'Sunita Rai (Community ASHA)', workerPhone: '+91 97420 11843', center: 'Ara Zonal PHC' },
      English: { workerName: 'Sister Mary D\'Souza (ASHA Lead)', workerPhone: '+91 99002 44512', center: 'Koramangala PHC' },
    };

    const assignedWorker = regionalData[patientLang] || regionalData['Hindi'];

    // Simulated Pub/Sub / Gateway SMS dispatch payload
    const ashaDispatchPayload = {
      dispatchId: `ASHA-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toISOString(),
      status: 'DISPATCHED_AND_ACKNOWLEDGED',
      assignedWorker: assignedWorker.workerName,
      workerPhone: assignedWorker.workerPhone,
      assignedCenter: assignedWorker.center,
      patientDetails: {
        name: patientName,
        diagnosis: primaryDiagnosis,
        urgency: urgencyLevel,
      },
      actionRequired: 'In-person health check within 4 hours. Initiating DOTS tracking protocol if applicable.',
    };

    console.log('[ASHA-Agent] Priority Alert Dispatched:', ashaDispatchPayload);

    return NextResponse.json({
      success: true,
      ashaDispatch: ashaDispatchPayload,
    });
  } catch (error: any) {
    console.error('ASHA-Agent Dispatch Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}