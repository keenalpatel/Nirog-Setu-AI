import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { patientLang, urgencyLevel, requiredSpecialty } = await request.json();

    const referralMapping: Record<string, any> = {
      Hindi: {
        facilityName: 'Sanjay Gandhi Regional PHC Sub-Centre',
        address: 'Sector 4, Near Community Hub, Lucknow, UP',
        distanceKm: '4.2 km',
        bedAvailability: '14 Beds Available',
        doctorOnDuty: 'Dr. R. K. Sharma (General Medicine)',
        emergencySupport: true,
      },
      Bhojpuri: {
        facilityName: 'Bhojpur Zonal Primary Health Centre',
        address: 'Station Road, Opp. Civil Hospital, Ara, Bihar',
        distanceKm: '2.8 km',
        bedAvailability: '6 Beds Available',
        doctorOnDuty: 'Dr. Suresh Verma (Chest Specialist)',
        emergencySupport: true,
      },
      English: {
        facilityName: 'National Urban Health PHC Facility',
        address: '7th Main, KHB Colony, Koramangala, Bengaluru, Karnataka',
        distanceKm: '3.1 km',
        bedAvailability: '22 Beds Available',
        doctorOnDuty: 'Dr. Ananya Rao (Pulmonologist)',
        emergencySupport: true,
      },
    };

    const matchedFacility = referralMapping[patientLang] || referralMapping['English'];

    return NextResponse.json({
      success: true,
      referral: {
        referralCode: `REF-${Math.floor(1000 + Math.random() * 9000)}`,
        facility: matchedFacility.facilityName,
        address: matchedFacility.address,
        distance: matchedFacility.distanceKm,
        beds: matchedFacility.bedAvailability,
        assignedDoctor: matchedFacility.doctorOnDuty,
        specialtyNeeded: requiredSpecialty || 'General Diagnostics',
        urgencyPriority: urgencyLevel,
      },
    });
  } catch (error: any) {
    console.error('Refer-Agent Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}