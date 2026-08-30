import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to generate normalized mock 1536-dim vector for embeddings
function generateMockEmbedding(): number[] {
  const vec = Array.from({ length: 1536 }, () => (Math.random() - 0.5) * 2)
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  return vec.map((v) => v / (norm || 1))
}

async function main() {
  console.log('🌱 Starting iLoyalty database seed...')

  // 1. Loyalty Configuration
  await prisma.loyaltyConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      earnRate: 0.0200,
      effectiveFrom: new Date(),
    },
  })
  console.log('✓ LoyaltyConfig configured')

  // 2. Pilot Hotels
  const hotelGrand = await prisma.hotel.upsert({
    where: { id: 'hotel_grand_01' },
    update: {},
    create: {
      id: 'hotel_grand_01',
      name: 'The Grand London Hotel',
      merchantAccountId: 'acct_grand_london_01',
      active: true,
    },
  })

  const hotelRoyal = await prisma.hotel.upsert({
    where: { id: 'hotel_royal_02' },
    update: {},
    create: {
      id: 'hotel_royal_02',
      name: 'The Royal Palm Edinburgh',
      merchantAccountId: 'acct_royal_edinburgh_02',
      active: true,
    },
  })

  const hotelOcean = await prisma.hotel.upsert({
    where: { id: 'hotel_ocean_03' },
    update: {},
    create: {
      id: 'hotel_ocean_03',
      name: 'Oceanview Resort & Spa Brighton',
      merchantAccountId: 'acct_ocean_brighton_03',
      active: true,
    },
  })
  console.log('✓ 3 Pilot Hotels created')

  // 3. Hotel Rooms & Descriptions
  const roomGrand1 = await prisma.room.upsert({
    where: { id: 'room_grand_101' },
    update: {},
    create: {
      id: 'room_grand_101',
      hotelId: hotelGrand.id,
      description: 'Executive King Suite with floor-to-ceiling panoramic views of central London, marble bathroom, and complimentary lounge access.',
      active: true,
      embedSyncedAt: new Date(),
    },
  })

  const roomGrand2 = await prisma.room.upsert({
    where: { id: 'room_grand_102' },
    update: {},
    create: {
      id: 'room_grand_102',
      hotelId: hotelGrand.id,
      description: 'Classic Deluxe Double Room featuring plush queen bed, bespoke British furnishing, and high-speed fibre WiFi.',
      active: true,
      embedSyncedAt: new Date(),
    },
  })

  const roomRoyal1 = await prisma.room.upsert({
    where: { id: 'room_royal_201' },
    update: {},
    create: {
      id: 'room_royal_201',
      hotelId: hotelRoyal.id,
      description: 'Highland Luxury Suite with heritage stone fireplace, Scottish tweed textiles, and private balcony overlooking Arthur’s Seat.',
      active: true,
      embedSyncedAt: new Date(),
    },
  })

  const roomOcean1 = await prisma.room.upsert({
    where: { id: 'room_ocean_301' },
    update: {},
    create: {
      id: 'room_ocean_301',
      hotelId: hotelOcean.id,
      description: 'Seaside Balcony King Room offering unobstructed coastal sea views, hydrotherapy bath, and private sunset terrace.',
      active: true,
      embedSyncedAt: new Date(),
    },
  })
  console.log('✓ Hotel Rooms created')

  // 4. Vector Embeddings (Shared records only - Hotel & Room descriptions)
  await prisma.hotelEmbedding.upsert({
    where: { id: hotelGrand.id },
    update: {},
    create: {
      id: hotelGrand.id,
      metadata: { name: hotelGrand.name, city: 'London', type: 'hotel' },
      embedding: generateMockEmbedding(),
    },
  })
  await prisma.hotelEmbedding.upsert({
    where: { id: hotelRoyal.id },
    update: {},
    create: {
      id: hotelRoyal.id,
      metadata: { name: hotelRoyal.name, city: 'Edinburgh', type: 'hotel' },
      embedding: generateMockEmbedding(),
    },
  })
  await prisma.hotelEmbedding.upsert({
    where: { id: hotelOcean.id },
    update: {},
    create: {
      id: hotelOcean.id,
      metadata: { name: hotelOcean.name, city: 'Brighton', type: 'hotel' },
      embedding: generateMockEmbedding(),
    },
  })

  for (const room of [roomGrand1, roomGrand2, roomRoyal1, roomOcean1]) {
    await prisma.roomEmbedding.upsert({
      where: { id: room.id },
      update: {},
      create: {
        id: room.id,
        hotelId: room.hotelId,
        metadata: { description: room.description, type: 'room' },
        embedding: generateMockEmbedding(),
      },
    })
  }
  console.log('✓ Vector Store Embeddings populated for Discovery Search')

  // 5. Redemption Rules (Owner-approved group-wide rules)
  const rulesData = [
    {
      id: 'rule_disc_10',
      description: '£10 Off Next Direct Booking',
      pointsCost: 200,
      active: true,
      approvedBy: 'owner_group_admin',
    },
    {
      id: 'rule_bfast_2',
      description: 'Complimentary Artisan Breakfast for Two',
      pointsCost: 350,
      active: true,
      approvedBy: 'owner_group_admin',
    },
    {
      id: 'rule_dining_50',
      description: '£50 Dining & Cocktail Credit',
      pointsCost: 600,
      active: true,
      approvedBy: 'owner_group_admin',
    },
    {
      id: 'rule_upgrade_exec',
      description: 'Executive Suite Upgrade on Check-In',
      pointsCost: 800,
      active: true,
      approvedBy: 'owner_group_admin',
    },
  ]

  for (const rule of rulesData) {
    await prisma.redemptionRule.upsert({
      where: { id: rule.id },
      update: {},
      create: rule,
    })
  }
  console.log('✓ Active Owner-Approved Redemption Rules created')

  // 6. Demo Guests
  const now = new Date()
  const demoGuest = await prisma.guest.upsert({
    where: { email: 'demo@iloyalty.test' },
    update: {},
    create: {
      id: 'guest_demo_01',
      email: 'demo@iloyalty.test',
      phone: '+44 7700 900077',
      createdAt: new Date(now.getTime() - 120 * 86400000), // 120 days ago
    },
  })

  const sarahGuest = await prisma.guest.upsert({
    where: { email: 'sarah.smith@example.com' },
    update: {},
    create: {
      id: 'guest_demo_02',
      email: 'sarah.smith@example.com',
      phone: '+44 7911 123456',
      createdAt: new Date(now.getTime() - 90 * 86400000),
    },
  })
  console.log('✓ Demo Guest accounts created (demo@iloyalty.test)')

  // 7. Stays and Points Transactions for demo guest
  // Stay 1: 345 days ago -> Points expiring in ~20 days (triggers 30-day expiry warning!)
  const stayOld = await prisma.stay.upsert({
    where: { pmsRecordId: 'PMS-LON-2025-0812' },
    update: {},
    create: {
      id: 'stay_demo_01',
      pmsRecordId: 'PMS-LON-2025-0812',
      guestId: demoGuest.id,
      hotelId: hotelOcean.id,
      checkIn: new Date(now.getTime() - 348 * 86400000),
      checkOut: new Date(now.getTime() - 345 * 86400000),
      accommodationSpend: 300.00,
      foodAndBeverageSpend: 50.00,
      otherSpend: 25.00,
      source: 'iLoyalty',
      manualEntry: false,
    },
  })

  await prisma.pointsTransaction.create({
    data: {
      guestId: demoGuest.id,
      stayId: stayOld.id,
      type: 'earned',
      amount: 350,
      // 365 days from 345 days ago = expires in 20 days!
      expiresAt: new Date(now.getTime() + 20 * 86400000),
      createdAt: new Date(now.getTime() - 345 * 86400000),
    },
  })

  // Stay 2: 90 days ago
  const stayMid = await prisma.stay.upsert({
    where: { pmsRecordId: 'PMS-LON-2026-0520' },
    update: {},
    create: {
      id: 'stay_demo_02',
      pmsRecordId: 'PMS-LON-2026-0520',
      guestId: demoGuest.id,
      hotelId: hotelGrand.id,
      checkIn: new Date(now.getTime() - 93 * 86400000),
      checkOut: new Date(now.getTime() - 90 * 86400000),
      accommodationSpend: 350.00,
      foodAndBeverageSpend: 100.00,
      otherSpend: 40.00,
      source: 'iLoyalty',
      manualEntry: false,
    },
  })

  await prisma.pointsTransaction.create({
    data: {
      guestId: demoGuest.id,
      stayId: stayMid.id,
      type: 'earned',
      amount: 450,
      expiresAt: new Date(now.getTime() + 275 * 86400000),
      createdAt: new Date(now.getTime() - 90 * 86400000),
    },
  })

  // Stay 3: 45 days ago
  const stayRecent = await prisma.stay.upsert({
    where: { pmsRecordId: 'PMS-EDI-2026-0715' },
    update: {},
    create: {
      id: 'stay_demo_03',
      pmsRecordId: 'PMS-EDI-2026-0715',
      guestId: demoGuest.id,
      hotelId: hotelRoyal.id,
      checkIn: new Date(now.getTime() - 48 * 86400000),
      checkOut: new Date(now.getTime() - 45 * 86400000),
      accommodationSpend: 500.00,
      foodAndBeverageSpend: 150.00,
      otherSpend: 10.00,
      source: 'iLoyalty',
      manualEntry: false,
    },
  })

  await prisma.pointsTransaction.create({
    data: {
      guestId: demoGuest.id,
      stayId: stayRecent.id,
      type: 'earned',
      amount: 650,
      expiresAt: new Date(now.getTime() + 320 * 86400000),
      createdAt: new Date(now.getTime() - 45 * 86400000),
    },
  })
  console.log('✓ Stays and 1,450 Points loaded (including 350 expiring within 30-day warning window)')

  // 8. Operational Logs & Merge Draft
  await prisma.syncLog.create({
    data: {
      hotelId: hotelGrand.id,
      status: 'SUCCESS',
      recordsProcessed: 14,
      recordsUpserted: 4,
      startedAt: new Date(now.getTime() - 3600000),
      completedAt: new Date(now.getTime() - 3550000),
    },
  })

  await prisma.syncLog.create({
    data: {
      hotelId: hotelRoyal.id,
      status: 'SUCCESS',
      recordsProcessed: 9,
      recordsUpserted: 2,
      startedAt: new Date(now.getTime() - 7200000),
      completedAt: new Date(now.getTime() - 7160000),
    },
  })

  await prisma.syncLog.create({
    data: {
      hotelId: hotelOcean.id,
      status: 'FAILED',
      errorMessage: 'PMS Connector Timeout on endpoint: /api/v2/reservations/export',
      recordsProcessed: 0,
      recordsUpserted: 0,
      startedAt: new Date(now.getTime() - 14400000),
      completedAt: new Date(now.getTime() - 14380000),
    },
  })

  await prisma.profileMergeDraft.upsert({
    where: { id: 'merge_draft_01' },
    update: {},
    create: {
      id: 'merge_draft_01',
      sourceGuestId: sarahGuest.id,
      targetGuestId: demoGuest.id,
      proposedBy: 'staff_frontdesk_london',
      reviewNote: 'Guest has duplicate booking profiles across London and Edinburgh properties with matching phone number.',
      status: 'PENDING',
    },
  })
  console.log('✓ Operational sync logs and sample merge draft created')

  console.log('\n🎉 iLoyalty database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
