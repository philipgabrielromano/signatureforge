import type { User } from "@prisma/client";

export type UserWithProfile = Pick<
  User,
  | "firstName"
  | "lastName"
  | "displayName"
  | "email"
  | "jobTitle"
  | "department"
  | "phone"
  | "mobile"
  | "companyName"
  | "officeLocation"
  | "customField1"
  | "customField2"
  | "customField3"
>;

export const VARIABLE_CATALOG = [
  { token: "{{firstName}}", label: "First name", description: "Given name from Azure AD" },
  { token: "{{lastName}}", label: "Last name", description: "Surname from Azure AD" },
  { token: "{{fullName}}", label: "Full name", description: "Display name" },
  { token: "{{email}}", label: "Email", description: "Primary SMTP address" },
  { token: "{{title}}", label: "Job title", description: "Job title" },
  { token: "{{department}}", label: "Department", description: "Department" },
  { token: "{{phone}}", label: "Phone", description: "Business phone, falling back to mobile" },
  { token: "{{mobile}}", label: "Mobile", description: "Mobile phone" },
  { token: "{{company}}", label: "Company", description: "Company name" },
  { token: "{{office}}", label: "Office", description: "Office location" },
  { token: "{{custom1}}", label: "Custom 1", description: "Custom field 1" },
  { token: "{{custom2}}", label: "Custom 2", description: "Custom field 2" },
  { token: "{{custom3}}", label: "Custom 3", description: "Custom field 3" },
] as const;

const VARIABLES: Record<string, (u: UserWithProfile) => string> = {
  "{{firstName}}": (u) => u.firstName || "",
  "{{lastName}}": (u) => u.lastName || "",
  "{{fullName}}": (u) => u.displayName,
  "{{email}}": (u) => u.email,
  "{{title}}": (u) => u.jobTitle || "",
  "{{department}}": (u) => u.department || "",
  "{{phone}}": (u) => u.phone || u.mobile || "",
  "{{mobile}}": (u) => u.mobile || "",
  "{{company}}": (u) => u.companyName || "",
  "{{office}}": (u) => u.officeLocation || "",
  "{{custom1}}": (u) => u.customField1 || "",
  "{{custom2}}": (u) => u.customField2 || "",
  "{{custom3}}": (u) => u.customField3 || "",
};

export const SAMPLE_USER: UserWithProfile = {
  firstName: "Alex",
  lastName: "Rivera",
  displayName: "Alex Rivera",
  email: "alex.rivera@contoso.com",
  jobTitle: "Director of Marketing",
  department: "Marketing",
  phone: "+1 (425) 555-0100",
  mobile: "+1 (425) 555-0199",
  companyName: "Contoso",
  officeLocation: "Seattle",
  customField1: "She/Her",
  customField2: "EXT-4400",
  customField3: "",
};

export function resolveVariables(html: string, user: UserWithProfile): string {
  let resolved = html;
  for (const [token, resolver] of Object.entries(VARIABLES)) {
    resolved = resolved.replaceAll(token, resolver(user));
  }
  return resolved.replace(/<p[^>]*>(\s|&nbsp;)*<\/p>/g, "");
}

export function toUserProfile(user: User): UserWithProfile {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    email: user.email,
    jobTitle: user.jobTitle,
    department: user.department,
    phone: user.phone,
    mobile: user.mobile,
    companyName: user.companyName,
    officeLocation: user.officeLocation,
    customField1: user.customField1,
    customField2: user.customField2,
    customField3: user.customField3,
  };
}
