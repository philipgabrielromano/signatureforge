import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const corporateHtml = `
<table cellpadding="0" cellspacing="0" style="font-family:Calibri,Arial,sans-serif;font-size:13px;color:#1f2937;">
  <tr>
    <td style="padding-right:16px;vertical-align:top;">
      <img src="https://placehold.co/88x88/4f46e5/ffffff.png?text=SF" width="88" height="88" alt="Contoso logo" style="border-radius:8px;" />
    </td>
    <td style="border-left:3px solid #4f46e5;padding-left:16px;">
      <div style="font-size:16px;font-weight:700;color:#111827;">{{fullName}}</div>
      <div style="color:#4f46e5;padding:2px 0 8px;">{{title}}</div>
      <div>{{department}} · {{company}}</div>
      <div>{{phone}}</div>
      <div><a href="mailto:{{email}}" style="color:#4f46e5;text-decoration:none;">{{email}}</a></div>
      <div style="padding-top:8px;">
        <a href="https://www.linkedin.com/company/contoso"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/linkedin.svg" width="16" height="16" alt="LinkedIn" /></a>
      </div>
    </td>
  </tr>
</table>
`.trim();

const minimalHtml = `
<div style="font-family:Calibri,Arial,sans-serif;font-size:13px;color:#111827;line-height:1.45;">
  <strong>{{fullName}}</strong><br/>
  <a href="mailto:{{email}}" style="color:#4f46e5;text-decoration:none;">{{email}}</a><br/>
  {{phone}}
</div>
`.trim();

const holidayHtml = `
<table cellpadding="0" cellspacing="0" style="font-family:Calibri,Arial,sans-serif;font-size:13px;color:#1f2937;">
  <tr>
    <td>
      <div style="font-size:16px;font-weight:700;">{{fullName}}</div>
      <div>{{title}} · {{company}}</div>
      <div>{{phone}} · <a href="mailto:{{email}}" style="color:#b45309;">{{email}}</a></div>
      <div style="padding-top:10px;">
        <img src="https://placehold.co/480x72/7c2d12/fef3c7.png?text=Happy+Holidays+from+Contoso" width="480" height="72" alt="Holiday banner" />
      </div>
    </td>
  </tr>
</table>
`.trim();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { domain: "contoso.com" },
    update: {},
    create: {
      name: "Contoso",
      domain: "contoso.com",
      azureClientId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      azureClientSecret: "placeholder-secret",
      azureTenantId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    },
  });

  await prisma.assignment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.schedule.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.templateVersion.deleteMany({
    where: { template: { tenantId: tenant.id } },
  });
  await prisma.template.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.auditLog.deleteMany({ where: { tenantId: tenant.id } });

  const corporate = await prisma.template.create({
    data: {
      tenantId: tenant.id,
      name: "Corporate Standard",
      description: "Default branded signature with logo, title, and LinkedIn.",
      htmlContent: corporateHtml,
      isDefault: true,
      isActive: true,
    },
  });

  const minimal = await prisma.template.create({
    data: {
      tenantId: tenant.id,
      name: "Minimal",
      description: "Name, email, and phone only.",
      htmlContent: minimalHtml,
      isActive: true,
    },
  });

  const holiday = await prisma.template.create({
    data: {
      tenantId: tenant.id,
      name: "Holiday Campaign",
      description: "Seasonal banner under the standard contact block.",
      htmlContent: holidayHtml,
      isActive: true,
    },
  });

  const sampleUsers = [
    {
      azureObjectId: "11111111-1111-1111-1111-111111111111",
      email: "jordan.lee@contoso.com",
      displayName: "Jordan Lee",
      firstName: "Jordan",
      lastName: "Lee",
      jobTitle: "Staff Engineer",
      department: "Engineering",
      phone: "+1 (425) 555-0110",
      companyName: "Contoso",
      officeLocation: "Redmond",
    },
    {
      azureObjectId: "22222222-2222-2222-2222-222222222222",
      email: "samira.khan@contoso.com",
      displayName: "Samira Khan",
      firstName: "Samira",
      lastName: "Khan",
      jobTitle: "Campaign Manager",
      department: "Marketing",
      phone: "+1 (425) 555-0142",
      companyName: "Contoso",
      officeLocation: "Seattle",
    },
    {
      azureObjectId: "33333333-3333-3333-3333-333333333333",
      email: "chris.patel@contoso.com",
      displayName: "Chris Patel",
      firstName: "Chris",
      lastName: "Patel",
      jobTitle: "Account Executive",
      department: "Sales",
      phone: "+1 (425) 555-0188",
      companyName: "Contoso",
      officeLocation: "Austin",
    },
    {
      azureObjectId: "44444444-4444-4444-4444-444444444444",
      email: "morgan.adesina@contoso.com",
      displayName: "Morgan Adesina",
      firstName: "Morgan",
      lastName: "Adesina",
      jobTitle: "People Partner",
      department: "HR",
      phone: "+1 (425) 555-0160",
      companyName: "Contoso",
      officeLocation: "London",
    },
    {
      azureObjectId: "55555555-5555-5555-5555-555555555555",
      email: "riley.chen@contoso.com",
      displayName: "Riley Chen",
      firstName: "Riley",
      lastName: "Chen",
      jobTitle: "IT Operations Lead",
      department: "IT",
      phone: "+1 (425) 555-0121",
      companyName: "Contoso",
      officeLocation: "Redmond",
    },
  ];

  for (const user of sampleUsers) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        ...user,
        signaturePushStatus: user.department === "IT" ? "pending" : "success",
        currentSignatureId: user.department === "IT" ? minimal.id : corporate.id,
        lastSignaturePushedAt: user.department === "IT" ? null : new Date(),
      },
    });
  }

  await prisma.assignment.create({
    data: {
      tenantId: tenant.id,
      templateId: corporate.id,
      isOrgWide: true,
      priority: 0,
      isActive: true,
    },
  });

  await prisma.assignment.create({
    data: {
      tenantId: tenant.id,
      templateId: minimal.id,
      isOrgWide: false,
      targetType: "department",
      targetValue: "IT",
      priority: 20,
      isActive: true,
    },
  });

  const startAt = new Date();
  startAt.setDate(startAt.getDate() + 7);

  await prisma.schedule.create({
    data: {
      tenantId: tenant.id,
      templateId: holiday.id,
      name: "Holiday Campaign 2026",
      description: "Festive banner for all staff, reverting to Corporate Standard.",
      isOrgWide: true,
      startAt,
      revertTemplateId: corporate.id,
      status: "scheduled",
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorEmail: "admin@signatureforge.local",
      action: "tenant.seeded",
      resourceType: "tenant",
      resourceId: tenant.id,
      details: { templates: 3, users: 5 },
    },
  });

  console.log("Seeded Contoso demo tenant with 3 templates, 5 users, 2 assignments, and 1 holiday schedule.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
