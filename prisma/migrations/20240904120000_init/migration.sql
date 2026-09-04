-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "azureClientId" TEXT NOT NULL,
    "azureClientSecret" TEXT NOT NULL,
    "azureTenantId" TEXT NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncFrequencyMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastSyncAt" TIMESTAMP(3),
    "autoDeployOnSave" BOOLEAN NOT NULL DEFAULT true,
    "deployBatchSize" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "azureObjectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "officeLocation" TEXT,
    "companyName" TEXT,
    "customField1" TEXT,
    "customField2" TEXT,
    "customField3" TEXT,
    "currentSignatureId" TEXT,
    "lastSignaturePushedAt" TIMESTAMP(3),
    "signaturePushStatus" TEXT NOT NULL DEFAULT 'pending',
    "signaturePushError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "htmlContent" TEXT NOT NULL,
    "previewUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "isOrgWide" BOOLEAN NOT NULL DEFAULT false,
    "targetType" TEXT,
    "targetValue" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetType" TEXT,
    "targetValue" TEXT,
    "isOrgWide" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "revertTemplateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "deployedAt" TIMESTAMP(3),
    "revertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureImage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "altText" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeployJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "total" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "DeployJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_domain_key" ON "Tenant"("domain");

-- CreateIndex
CREATE INDEX "User_tenantId_signaturePushStatus_idx" ON "User"("tenantId", "signaturePushStatus");

-- CreateIndex
CREATE INDEX "User_tenantId_department_idx" ON "User"("tenantId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_azureObjectId_key" ON "User"("tenantId", "azureObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "TemplateVersion_templateId_version_idx" ON "TemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "Assignment_tenantId_isActive_idx" ON "Assignment"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Schedule_tenantId_status_idx" ON "Schedule"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Schedule_startAt_endAt_idx" ON "Schedule"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "SignatureImage_tenantId_idx" ON "SignatureImage"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_action_idx" ON "AuditLog"("tenantId", "action");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentSignatureId_fkey" FOREIGN KEY ("currentSignatureId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureImage" ADD CONSTRAINT "SignatureImage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
