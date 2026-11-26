import {
  PrismaClient,
  Brand,
  BrandProcessRule,
  Process,
  RoleType,
  OperatingCalendar,
  AssignmentType,
  LeaveType,
  LeaveStatus,
  UserRole,
} from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clear existing data (idempotent)
  await prisma.shiftEntry.deleteMany();
  await prisma.rosterVersion.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.holidayCalendar.deleteMany();
  await prisma.employeeAllocation.deleteMany();
  await prisma.brandProcessRule.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.pod.deleteMany();

  console.log('Cleared existing data');

  // ========== STEP 1: Create 3 Pods ==========
  const podAlpha = await prisma.pod.create({ data: { name: 'Pod Alpha' } });
  const podBeta = await prisma.pod.create({ data: { name: 'Pod Beta' } });
  const podGamma = await prisma.pod.create({ data: { name: 'Pod Gamma' } });

  console.log('Created 3 Pods');

  // ========== STEP 2: Create Exactly 35 Employees (12 Alpha + 12 Beta + 11 Gamma) ==========
  const employeesData = [
    // Pod Alpha - 12 employees (indices 0..11)
    { name: 'Alice Kumar', email: 'alice.kumar@company.com', podId: podAlpha.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Bob Singh', email: 'bob.singh@company.com', podId: podAlpha.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.ACC], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Carol Desai', email: 'carol.desai@company.com', podId: podAlpha.id, roleType: RoleType.SHARED, processSkillTags: [Process.CS, Process.NDR], preferredWeeklyOff: 6, maxDailyCapacity: 1.0 },
    { name: 'David Patel', email: 'david.patel@company.com', podId: podAlpha.id, roleType: RoleType.SHARED, processSkillTags: [Process.CS, Process.RETENTION], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Emma Sharma', email: 'emma.sharma@company.com', podId: podAlpha.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.NDR], preferredWeeklyOff: 1, maxDailyCapacity: 1.0 },
    { name: 'Frank Reddy', email: 'frank.reddy@company.com', podId: podAlpha.id, roleType: RoleType.FLOAT_BACKUP, processSkillTags: [Process.CS, Process.ACC, Process.NDR], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Grace Nair', email: 'grace.nair@company.com', podId: podAlpha.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Henry Iyer', email: 'henry.iyer@company.com', podId: podAlpha.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS, Process.ACC], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Ivy Menon', email: 'ivy.menon@company.com', podId: podAlpha.id, roleType: RoleType.SHARED, processSkillTags: [Process.CS, Process.ACC], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Jack Rao', email: 'jack.rao@company.com', podId: podAlpha.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS, Process.RETENTION], preferredWeeklyOff: 3, maxDailyCapacity: 1.0 },
    { name: 'Kathy Pillai', email: 'kathy.pillai@company.com', podId: podAlpha.id, roleType: RoleType.FLOAT_BACKUP, processSkillTags: [Process.CS, Process.NDR, Process.RETENTION], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Leo Thomas', email: 'leo.thomas@company.com', podId: podAlpha.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },

    // Pod Beta - 12 employees (indices 12..23)
    { name: 'Mia George', email: 'mia.george@company.com', podId: podBeta.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Noah Varghese', email: 'noah.varghese@company.com', podId: podBeta.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS, Process.ACC], preferredWeeklyOff: 4, maxDailyCapacity: 1.0 },
    { name: 'Olivia Joseph', email: 'olivia.joseph@company.com', podId: podBeta.id, roleType: RoleType.SHARED, processSkillTags: [Process.CS, Process.ACC], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Paul Matthew', email: 'paul.matthew@company.com', podId: podBeta.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.NDR], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Quinn Jacob', email: 'quinn.jacob@company.com', podId: podBeta.id, roleType: RoleType.FLOAT_BACKUP, processSkillTags: [Process.CS, Process.NDR, Process.RETENTION], preferredWeeklyOff: 5, maxDailyCapacity: 1.0 },
    { name: 'Rachel Philip', email: 'rachel.philip@company.com', podId: podBeta.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Sam Alexander', email: 'sam.alexander@company.com', podId: podBeta.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.RETENTION], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Tina Simon', email: 'tina.simon@company.com', podId: podBeta.id, roleType: RoleType.SHARED, processSkillTags: [Process.CS, Process.RETENTION], preferredWeeklyOff: 1, maxDailyCapacity: 1.0 },
    { name: 'Uma Daniel', email: 'uma.daniel@company.com', podId: podBeta.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS, Process.ACC], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Victor John', email: 'victor.john@company.com', podId: podBeta.id, roleType: RoleType.FLOAT_BACKUP, processSkillTags: [Process.CS, Process.ACC], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Wendy Luke', email: 'wendy.luke@company.com', podId: podBeta.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS, Process.NDR], preferredWeeklyOff: 2, maxDailyCapacity: 1.0 },
    { name: 'Vera Nair', email: 'vera.nair@company.com', podId: podBeta.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },

    // Pod Gamma - 11 employees (indices 24..34)
    { name: 'Xander Mark', email: 'xander.mark@company.com', podId: podGamma.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Yara Peter', email: 'yara.peter@company.com', podId: podGamma.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.ACC], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Zane Stephen', email: 'zane.stephen@company.com', podId: podGamma.id, roleType: RoleType.SHARED, processSkillTags: [Process.CS, Process.NDR], preferredWeeklyOff: 3, maxDailyCapacity: 1.0 },
    { name: 'Aria Paul', email: 'aria.paul@company.com', podId: podGamma.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.NDR], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Blake Andrew', email: 'blake.andrew@company.com', podId: podGamma.id, roleType: RoleType.FLOAT_BACKUP, processSkillTags: [Process.CS, Process.ACC, Process.NDR, Process.RETENTION], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Chloe James', email: 'chloe.james@company.com', podId: podGamma.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS], preferredWeeklyOff: 4, maxDailyCapacity: 1.0 },
    { name: 'Dylan Mathew', email: 'dylan.mathew@company.com', podId: podGamma.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.RETENTION], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Ella Benjamin', email: 'ella.benjamin@company.com', podId: podGamma.id, roleType: RoleType.SHARED, processSkillTags: [Process.CS, Process.ACC, Process.RETENTION], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Finn Samuel', email: 'finn.samuel@company.com', podId: podGamma.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS], preferredWeeklyOff: 5, maxDailyCapacity: 1.0 },
    { name: 'Gina Joshua', email: 'gina.joshua@company.com', podId: podGamma.id, roleType: RoleType.FLOAT_BACKUP, processSkillTags: [Process.CS, Process.NDR], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
    { name: 'Liam Menon', email: 'liam.menon@company.com', podId: podGamma.id, roleType: RoleType.DEDICATED, processSkillTags: [Process.CS, Process.RETENTION], preferredWeeklyOff: 0, maxDailyCapacity: 1.0 },
  ];

  const employees = await Promise.all(
    employeesData.map((data) => prisma.employee.create({ data }))
  );

  console.log(`Created ${employees.length} Employees`);

  // ========== STEP 3: Assign Pod Leads ==========
  await prisma.pod.update({ where: { id: podAlpha.id }, data: { podLeadId: employees[0].id } });
  await prisma.pod.update({ where: { id: podBeta.id }, data: { podLeadId: employees[12].id } });
  await prisma.pod.update({ where: { id: podGamma.id }, data: { podLeadId: employees[24].id } });

  console.log('Assigned Pod Leads');

  // ========== STEP 4: Create 22 D2C Brands (18 single-resource + 4 multi-resource) ==========
  const brandsData = [
    // Pod Alpha - 8 brands (1 multi-resource: TechGadgets)
    { name: 'FashionHub', podId: podAlpha.id, accountTier: 'Premium', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.ALL_365, minHeadcount: 1 }] },
    { name: 'HomeEssentials', podId: podAlpha.id, accountTier: 'Standard', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.EXCL_SUN_PH, minHeadcount: 1 }] }, // SPOF risk
    { name: 'TechGadgets', podId: podAlpha.id, accountTier: 'Premium', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.EXCL_SUN_PH, minHeadcount: 1 }, { process: Process.ACC, operatingCalendar: OperatingCalendar.EXCL_PH, minHeadcount: 1 }] }, // multi-resource
    { name: 'BeautyBurst', podId: podAlpha.id, accountTier: 'Standard', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.EXCL_PH, minHeadcount: 1 }] },
    { name: 'FitLife', podId: podAlpha.id, accountTier: 'Standard', processes: [{ process: Process.NDR, operatingCalendar: OperatingCalendar.ALL_365, minHeadcount: 1 }] },
    { name: 'PetParadise', podId: podAlpha.id, accountTier: 'Basic', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.EXCL_PH, minHeadcount: 1 }] },
    { name: 'SnackBox', podId: podAlpha.id, accountTier: 'Standard', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.ALL_365, minHeadcount: 1 }] },
    { name: 'BookWorm', podId: podAlpha.id, accountTier: 'Basic', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.EXCL_SUN_PH, minHeadcount: 1 }] }, // SPOF risk

    // Pod Beta - 7 brands (1 multi-resource: ActiveWear)
    { name: 'ActiveWear', podId: podBeta.id, accountTier: 'Premium', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.ALL_365, minHeadcount: 1 }, { process: Process.RETENTION, operatingCalendar: OperatingCalendar.EXCL_PH, minHeadcount: 1 }] }, // multi-resource
    { name: 'KitchenPro', podId: podBeta.id, accountTier: 'Standard', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.EXCL_PH, minHeadcount: 1 }] },
    { name: 'GardenGuru', podId: podBeta.id, accountTier: 'Standard', processes: [{ process: Process.NDR, operatingCalendar: OperatingCalendar.ALL_365, minHeadcount: 1 }] },
    { name: 'BabyJoy', podId: podBeta.id, accountTier: 'Premium', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.ALL_365, minHeadcount: 1 }] },
    { name: 'ArtSupply', podId: podBeta.id, accountTier: 'Basic', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.EXCL_SUN_PH, minHeadcount: 1 }] }, // SPOF risk
    { name: 'MusicMania', podId: podBeta.id, accountTier: 'Standard', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.EXCL_PH, minHeadcount: 1 }] },
    { name: 'TravelGear', podId: podBeta.id, accountTier: 'Premium', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.ALL_365, minHeadcount: 1 }] },

    // Pod Gamma - 7 brands (2 multi-resource: EcoFriendly, WellnessZone)
    { name: 'EcoFriendly', podId: podGamma.id, accountTier: 'Premium', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.ALL_365, minHeadcount: 1 }, { process: Process.ACC, operatingCalendar: OperatingCalendar.EXCL_PH, minHeadcount: 1 }] }, // multi-resource
    { name: 'SmartHome', podId: podGamma.id, accountTier: 'Premium', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.ALL_365, minHeadcount: 1 }] },
    { name: 'OfficeHub', podId: podGamma.id, accountTier: 'Standard', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.EXCL_PH, minHeadcount: 1 }] },
    { name: 'ToyWorld', podId: podGamma.id, accountTier: 'Standard', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.EXCL_PH, minHeadcount: 1 }] },
    { name: 'WellnessZone', podId: podGamma.id, accountTier: 'Premium', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.ALL_365, minHeadcount: 1 }, { process: Process.RETENTION, operatingCalendar: OperatingCalendar.EXCL_PH, minHeadcount: 1 }] }, // multi-resource
    { name: 'CraftCorner', podId: podGamma.id, accountTier: 'Basic', processes: [{ process: Process.CS, operatingCalendar: OperatingCalendar.EXCL_SUN_PH, minHeadcount: 1 }] }, // SPOF risk
    { name: 'AutoParts', podId: podGamma.id, accountTier: 'Standard', processes: [{ process: Process.NDR, operatingCalendar: OperatingCalendar.ALL_365, minHeadcount: 1 }] },
  ];

  const brands: Brand[] = [];
  const brandProcessRules: BrandProcessRule[] = [];

  for (const brandData of brandsData) {
    const brand = await prisma.brand.create({
      data: {
        name: brandData.name,
        podId: brandData.podId,
        accountTier: brandData.accountTier,
      },
    });
    brands.push(brand);

    for (const processData of brandData.processes) {
      const rule = await prisma.brandProcessRule.create({
        data: {
          brandId: brand.id,
          process: processData.process,
          operatingCalendar: processData.operatingCalendar,
          minHeadcount: processData.minHeadcount,
        },
      });
      brandProcessRules.push(rule);
    }
  }

  console.log(`Created ${brands.length} Brands and ${brandProcessRules.length} Process Rules`);

  const ruleId = (brandIdx: number, proc: Process) => {
    const found = brandProcessRules.find(
      (r) => r.brandId === brands[brandIdx].id && r.process === proc
    );
    if (!found) {
      throw new Error(`Missing BrandProcessRule for brand ${brands[brandIdx]?.name} process ${proc}`);
    }
    return found.id;
  };

  // ========== STEP 5: Create EmployeeAllocations ==========
  const allocations = [
    // Pod Alpha
    // 0: FashionHub (CS, ALL_365)
    { employeeId: employees[0].id, brandProcessRuleId: ruleId(0, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[5].id, brandProcessRuleId: ruleId(0, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // 1: HomeEssentials (CS, EXCL_SUN_PH) - intentional SPOF (no backup)
    { employeeId: employees[6].id, brandProcessRuleId: ruleId(1, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },

    // 2: TechGadgets (CS + ACC, multi-resource)
    { employeeId: employees[2].id, brandProcessRuleId: ruleId(2, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 0.5 },
    { employeeId: employees[8].id, brandProcessRuleId: ruleId(2, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.5 },
    { employeeId: employees[1].id, brandProcessRuleId: ruleId(2, Process.ACC), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[8].id, brandProcessRuleId: ruleId(2, Process.ACC), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.5 },
    { employeeId: employees[5].id, brandProcessRuleId: ruleId(2, Process.ACC), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // 3: BeautyBurst (CS, EXCL_PH)
    { employeeId: employees[11].id, brandProcessRuleId: ruleId(3, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[10].id, brandProcessRuleId: ruleId(3, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // 4: FitLife (NDR, ALL_365)
    { employeeId: employees[4].id, brandProcessRuleId: ruleId(4, Process.NDR), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[5].id, brandProcessRuleId: ruleId(4, Process.NDR), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },
    { employeeId: employees[10].id, brandProcessRuleId: ruleId(4, Process.NDR), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // 5: PetParadise (CS, EXCL_PH)
    { employeeId: employees[3].id, brandProcessRuleId: ruleId(5, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[8].id, brandProcessRuleId: ruleId(5, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.5 },

    // 6: SnackBox (CS, ALL_365)
    { employeeId: employees[9].id, brandProcessRuleId: ruleId(6, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[10].id, brandProcessRuleId: ruleId(6, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.4 },

    // 7: BookWorm (CS, EXCL_SUN_PH) - intentional SPOF (no backup)
    { employeeId: employees[7].id, brandProcessRuleId: ruleId(7, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },

    // Pod Beta
    // 8: ActiveWear (CS + RETENTION, multi-resource)
    { employeeId: employees[12].id, brandProcessRuleId: ruleId(8, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[16].id, brandProcessRuleId: ruleId(8, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },
    { employeeId: employees[18].id, brandProcessRuleId: ruleId(8, Process.RETENTION), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[16].id, brandProcessRuleId: ruleId(8, Process.RETENTION), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // 9: KitchenPro (CS, EXCL_PH)
    { employeeId: employees[17].id, brandProcessRuleId: ruleId(9, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[21].id, brandProcessRuleId: ruleId(9, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // 10: GardenGuru (NDR, ALL_365)
    { employeeId: employees[15].id, brandProcessRuleId: ruleId(10, Process.NDR), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[16].id, brandProcessRuleId: ruleId(10, Process.NDR), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.4 },

    // 11: BabyJoy (CS, ALL_365)
    { employeeId: employees[14].id, brandProcessRuleId: ruleId(11, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[19].id, brandProcessRuleId: ruleId(11, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.5 },

    // 12: ArtSupply (CS, EXCL_SUN_PH) - intentional SPOF (no backup)
    { employeeId: employees[23].id, brandProcessRuleId: ruleId(12, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },

    // 13: MusicMania (CS, EXCL_PH)
    { employeeId: employees[22].id, brandProcessRuleId: ruleId(13, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[21].id, brandProcessRuleId: ruleId(13, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },
    { employeeId: employees[13].id, brandProcessRuleId: ruleId(13, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // 14: TravelGear (CS, ALL_365)
    { employeeId: employees[20].id, brandProcessRuleId: ruleId(14, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[21].id, brandProcessRuleId: ruleId(14, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.4 },
    { employeeId: employees[13].id, brandProcessRuleId: ruleId(14, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // Pod Gamma
    // 15: EcoFriendly (CS + ACC, multi-resource)
    { employeeId: employees[24].id, brandProcessRuleId: ruleId(15, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[28].id, brandProcessRuleId: ruleId(15, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },
    { employeeId: employees[25].id, brandProcessRuleId: ruleId(15, Process.ACC), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[28].id, brandProcessRuleId: ruleId(15, Process.ACC), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // 16: SmartHome (CS, ALL_365)
    { employeeId: employees[29].id, brandProcessRuleId: ruleId(16, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[33].id, brandProcessRuleId: ruleId(16, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.4 },

    // 17: OfficeHub (CS, EXCL_PH)
    { employeeId: employees[32].id, brandProcessRuleId: ruleId(17, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[33].id, brandProcessRuleId: ruleId(17, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // 18: ToyWorld (CS, EXCL_PH)
    { employeeId: employees[26].id, brandProcessRuleId: ruleId(18, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[33].id, brandProcessRuleId: ruleId(18, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // 19: WellnessZone (CS + RETENTION, multi-resource)
    { employeeId: employees[31].id, brandProcessRuleId: ruleId(19, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[28].id, brandProcessRuleId: ruleId(19, Process.CS), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },
    { employeeId: employees[30].id, brandProcessRuleId: ruleId(19, Process.RETENTION), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[28].id, brandProcessRuleId: ruleId(19, Process.RETENTION), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },

    // 20: CraftCorner (CS, EXCL_SUN_PH) - intentional SPOF (no backup)
    { employeeId: employees[34].id, brandProcessRuleId: ruleId(20, Process.CS), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },

    // 21: AutoParts (NDR, ALL_365)
    { employeeId: employees[27].id, brandProcessRuleId: ruleId(21, Process.NDR), assignmentType: AssignmentType.PRIMARY, allocationWeight: 1.0 },
    { employeeId: employees[33].id, brandProcessRuleId: ruleId(21, Process.NDR), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },
    { employeeId: employees[28].id, brandProcessRuleId: ruleId(21, Process.NDR), assignmentType: AssignmentType.SECONDARY_BACKUP, allocationWeight: 0.3 },
  ];

  await prisma.employeeAllocation.createMany({ data: allocations });
  console.log(`Created ${allocations.length} Employee Allocations`);

  // ========== STEP 6: Create HolidayCalendar for 2026-11 ==========
  const holidays = [
    { date: new Date('2026-11-01T00:00:00Z'), name: 'All Saints Day', isPublicHoliday: true },
    { date: new Date('2026-11-15T00:00:00Z'), name: 'Mid-Month Public Holiday', isPublicHoliday: true },
  ];

  await prisma.holidayCalendar.createMany({ data: holidays });
  console.log('Created Holiday Calendar for 2026-11');

  // ========== STEP 7: Create LeaveRequests for 2026-11 ==========
  const leaveRequests = [
    // Pod Alpha leaves (none on SPOF single-resource brands without backup)
    { employeeId: employees[0].id, date: new Date('2026-11-05T00:00:00Z'), type: LeaveType.APPROVED_LEAVE, status: LeaveStatus.APPROVED, reason: 'Family event' },
    { employeeId: employees[1].id, date: new Date('2026-11-12T00:00:00Z'), type: LeaveType.COMP_OFF, status: LeaveStatus.APPROVED, reason: 'Weekend work compensation' },
    { employeeId: employees[4].id, date: new Date('2026-11-20T00:00:00Z'), type: LeaveType.APPROVED_LEAVE, status: LeaveStatus.APPROVED, reason: 'Medical appointment' },
    { employeeId: employees[9].id, date: new Date('2026-11-25T00:00:00Z'), type: LeaveType.APPROVED_LEAVE, status: LeaveStatus.APPROVED, reason: 'Personal' },

    // Pod Beta leaves
    { employeeId: employees[12].id, date: new Date('2026-11-08T00:00:00Z'), type: LeaveType.APPROVED_LEAVE, status: LeaveStatus.APPROVED, reason: 'Vacation' },
    { employeeId: employees[15].id, date: new Date('2026-11-18T00:00:00Z'), type: LeaveType.COMP_OFF, status: LeaveStatus.APPROVED, reason: 'Holiday work compensation' },
    { employeeId: employees[18].id, date: new Date('2026-11-27T00:00:00Z'), type: LeaveType.APPROVED_LEAVE, status: LeaveStatus.APPROVED, reason: 'Family function' },

    // Pod Gamma leaves
    { employeeId: employees[24].id, date: new Date('2026-11-10T00:00:00Z'), type: LeaveType.APPROVED_LEAVE, status: LeaveStatus.APPROVED, reason: 'Conference' },
    { employeeId: employees[26].id, date: new Date('2026-11-16T00:00:00Z'), type: LeaveType.COMP_OFF, status: LeaveStatus.APPROVED, reason: 'Weekend work compensation' },
    { employeeId: employees[29].id, date: new Date('2026-11-22T00:00:00Z'), type: LeaveType.APPROVED_LEAVE, status: LeaveStatus.APPROVED, reason: 'Wedding' },
    { employeeId: employees[32].id, date: new Date('2026-11-28T00:00:00Z'), type: LeaveType.APPROVED_LEAVE, status: LeaveStatus.APPROVED, reason: 'Personal' },
  ];

  await prisma.leaveRequest.createMany({ data: leaveRequests });
  console.log(`Created ${leaveRequests.length} Leave Requests for 2026-11`);

  // ========== STEP 8: Upsert Auth Users ==========
  const defaultUsers = [
    { email: 'admin@roaster.io', name: 'Operations Admin', role: UserRole.ADMIN, passwordHash: hashPassword('Admin@123') },
    { email: 'alice.kumar@company.com', name: 'Alice Kumar', role: UserRole.POD_LEAD, passwordHash: hashPassword('PodLead@123') },
    { email: 'mia.george@company.com', name: 'Mia George', role: UserRole.POD_LEAD, passwordHash: hashPassword('PodLead@123') },
    { email: 'xander.mark@company.com', name: 'Xander Mark', role: UserRole.POD_LEAD, passwordHash: hashPassword('PodLead@123') },
  ];

  for (const u of defaultUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: u,
    });
  }
  console.log(`Seeded ${defaultUsers.length} Auth Users`);
  console.log('Seed completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
