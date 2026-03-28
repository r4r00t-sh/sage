'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AiTextarea } from '@/components/ai-textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Briefcase, Phone, GraduationCap, AlertTriangle, FileText } from 'lucide-react';

const GENDER_OPTIONS = ['', 'Male', 'Female', 'Non-binary', 'Prefer not to say'];
const MARITAL_OPTIONS = ['', 'Single', 'Married', 'Divorced', 'Widowed'];
const BLOOD_OPTIONS = ['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];
const EMPLOYMENT_OPTIONS = ['', 'Full-Time', 'Part-Time', 'Contract', 'Intern', 'Consultant'];
const ACCOUNT_STATUS_OPTIONS = ['', 'Active', 'On Leave', 'Suspended', 'Terminated', 'Retired'];
const RELATIONSHIP_OPTIONS = ['', 'Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other'];
const QUALIFICATION_OPTIONS = [
  '', '10th Standard / Secondary School', '12th Standard / Higher Secondary / Diploma',
  'ITI / Trade Certificate', 'Polytechnic Diploma', 'Bachelor of Arts (BA)', 'Bachelor of Science (BSc)',
  'Bachelor of Commerce (BCom)', 'Bachelor of Technology / Engineering (BTech / BE)', 'Bachelor of Business Administration (BBA)',
  'Bachelor of Computer Applications (BCA)', 'Master of Arts (MA)', 'Master of Science (MSc)', 'Master of Commerce (MCom)',
  'Master of Technology / Engineering (MTech / ME)', 'Master of Business Administration (MBA)', 'Master of Computer Applications (MCA)',
  'Doctor of Philosophy (Ph.D.)', 'Chartered Accountant (CA) / CFA / CPA', 'Medical Degree (MBBS / MD)', 'Law Degree (LLB / LLM)', 'Others',
];

export interface StaffProfileFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  maritalStatus: string;
  bloodGroup: string;
  staffId: string;
  designation: string;
  department: string;
  division: string;
  employmentType: string;
  dateOfJoining: string;
  contractEndDate: string;
  reportingOfficial: string;
  workLocation: string;
  officeExtension: string;
  accountStatus: string;
  email: string;
  personalEmail: string;
  phone: string;
  phoneAlternate: string;
  address: string;
  city: string;
  postalCode: string;
  highestQualification: string;
  fieldOfStudy: string;
  institution: string;
  yearOfGraduation: string;
  skills: string[];
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  emergencyContactPhoneAlt: string;
  emergencyContactEmail: string;
  adminNotes: string;
  bio: string;
}

const emptyFormData: StaffProfileFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  nationality: '',
  maritalStatus: '',
  bloodGroup: '',
  staffId: '',
  designation: '',
  department: '',
  division: '',
  employmentType: '',
  dateOfJoining: '',
  contractEndDate: '',
  reportingOfficial: '',
  workLocation: '',
  officeExtension: '',
  accountStatus: '',
  email: '',
  personalEmail: '',
  phone: '',
  phoneAlternate: '',
  address: '',
  city: '',
  postalCode: '',
  highestQualification: '',
  fieldOfStudy: '',
  institution: '',
  yearOfGraduation: '',
  skills: [],
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactPhone: '',
  emergencyContactPhoneAlt: '',
  emergencyContactEmail: '',
  adminNotes: '',
  bio: '',
};

export function getEmptyStaffProfileFormData(): StaffProfileFormData {
  return { ...emptyFormData };
}

export function staffProfileFromUser(user: Record<string, unknown>): StaffProfileFormData {
  const skills = typeof user.skills === 'string' ? (() => { try { return JSON.parse(user.skills as string) as string[]; } catch { return []; } })() : (user.skills as string[]) ?? [];
  return {
    firstName: (user.firstName as string) ?? '',
    middleName: (user.middleName as string) ?? '',
    lastName: (user.lastName as string) ?? '',
    dateOfBirth: user.dateOfBirth ? (typeof user.dateOfBirth === 'string' ? user.dateOfBirth : (user.dateOfBirth as Date).toString().slice(0, 10)) : '',
    gender: (user.gender as string) ?? '',
    nationality: (user.nationality as string) ?? '',
    maritalStatus: (user.maritalStatus as string) ?? '',
    bloodGroup: (user.bloodGroup as string) ?? '',
    staffId: (user.staffId as string) ?? '',
    designation: (user.designation as string) ?? '',
    department: (user.department as { name?: string })?.name ?? '',
    division: (user.division as { name?: string })?.name ?? '',
    employmentType: (user.employmentType as string) ?? '',
    dateOfJoining: user.dateOfJoining ? (typeof user.dateOfJoining === 'string' ? user.dateOfJoining.slice(0, 10) : (user.dateOfJoining as Date).toString().slice(0, 10)) : '',
    contractEndDate: user.contractEndDate ? (typeof user.contractEndDate === 'string' ? user.contractEndDate.slice(0, 10) : (user.contractEndDate as Date).toString().slice(0, 10)) : '',
    reportingOfficial: (user.reportingOfficial as string) ?? '',
    workLocation: (user.workLocation as string) ?? '',
    officeExtension: (user.officeExtension as string) ?? '',
    accountStatus: (user.accountStatus as string) ?? '',
    email: (user.email as string) ?? '',
    personalEmail: (user.personalEmail as string) ?? '',
    phone: (user.phone as string) ?? '',
    phoneAlternate: (user.phoneAlternate as string) ?? '',
    address: (user.address as string) ?? '',
    city: (user.city as string) ?? '',
    postalCode: (user.postalCode as string) ?? '',
    highestQualification: (user.highestQualification as string) ?? '',
    fieldOfStudy: (user.fieldOfStudy as string) ?? '',
    institution: (user.institution as string) ?? '',
    yearOfGraduation: user.yearOfGraduation != null ? String(user.yearOfGraduation) : '',
    skills: Array.isArray(skills) ? skills : [],
    emergencyContactName: (user.emergencyContactName as string) ?? '',
    emergencyContactRelationship: (user.emergencyContactRelationship as string) ?? '',
    emergencyContactPhone: (user.emergencyContactPhone as string) ?? '',
    emergencyContactPhoneAlt: (user.emergencyContactPhoneAlt as string) ?? '',
    emergencyContactEmail: (user.emergencyContactEmail as string) ?? '',
    adminNotes: (user.adminNotes as string) ?? '',
    bio: (user.bio as string) ?? '',
  };
}

export function staffProfileToPayload(data: StaffProfileFormData): Record<string, unknown> {
  return {
    firstName: data.firstName || undefined,
    middleName: data.middleName || undefined,
    lastName: data.lastName || undefined,
    name: [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ') || undefined,
    dateOfBirth: data.dateOfBirth || undefined,
    gender: data.gender || undefined,
    nationality: data.nationality || undefined,
    maritalStatus: data.maritalStatus || undefined,
    bloodGroup: data.bloodGroup || undefined,
    staffId: data.staffId || undefined,
    designation: data.designation || undefined,
    employmentType: data.employmentType || undefined,
    dateOfJoining: data.dateOfJoining || undefined,
    contractEndDate: data.contractEndDate || undefined,
    reportingOfficial: data.reportingOfficial || undefined,
    workLocation: data.workLocation || undefined,
    officeExtension: data.officeExtension || undefined,
    accountStatus: data.accountStatus || undefined,
    email: data.email || undefined,
    personalEmail: data.personalEmail || undefined,
    phone: data.phone || undefined,
    phoneAlternate: data.phoneAlternate || undefined,
    address: data.address || undefined,
    city: data.city || undefined,
    postalCode: data.postalCode || undefined,
    highestQualification: data.highestQualification || undefined,
    fieldOfStudy: data.fieldOfStudy || undefined,
    institution: data.institution || undefined,
    yearOfGraduation: data.yearOfGraduation ? parseInt(data.yearOfGraduation, 10) : undefined,
    skills: data.skills.length ? data.skills : undefined,
    emergencyContactName: data.emergencyContactName || undefined,
    emergencyContactRelationship: data.emergencyContactRelationship || undefined,
    emergencyContactPhone: data.emergencyContactPhone || undefined,
    emergencyContactPhoneAlt: data.emergencyContactPhoneAlt || undefined,
    emergencyContactEmail: data.emergencyContactEmail || undefined,
    adminNotes: data.adminNotes || undefined,
    bio: data.bio || undefined,
  };
}

interface StaffProfileFormProps {
  data: StaffProfileFormData;
  onChange: (data: StaffProfileFormData) => void;
  disabled?: boolean;
  onSubmit?: (e: React.FormEvent) => void;
  saving?: boolean;
  submitLabel?: string;
  markComplete?: boolean;
  showSubmit?: boolean;
}

export function StaffProfileForm({
  data,
  onChange,
  disabled = false,
  onSubmit,
  saving = false,
  submitLabel = 'Save profile',
  markComplete = false,
  showSubmit = true,
}: StaffProfileFormProps) {
  const set = (key: keyof StaffProfileFormData, value: string | string[]) => {
    onChange({ ...data, [key]: value });
  };

  const addSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const input = e.currentTarget;
    const val = input.value.trim().replace(/,$/, '');
    if (!val || data.skills.includes(val)) {
      input.value = '';
      return;
    }
    set('skills', [...data.skills, val]);
    input.value = '';
  };

  const removeSkill = (index: number) => {
    set('skills', data.skills.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Basic Information
          </CardTitle>
          <CardDescription>Personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input value={data.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="e.g. Arjun" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Middle Name</Label>
              <Input value={data.middleName} onChange={(e) => set('middleName', e.target.value)} placeholder="(optional)" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input value={data.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="e.g. Krishnamurthy" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth *</Label>
              <Input type="date" value={data.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Gender *</Label>
              <Select value={data.gender || ' '} onValueChange={(v) => set('gender', v === ' ' ? '' : v)} disabled={disabled}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((o) => (
                    <SelectItem key={o || 'blank'} value={o || ' '}>{o || 'Select'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nationality</Label>
              <Input value={data.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder="e.g. Indian" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Marital Status</Label>
              <Select value={data.maritalStatus || ' '} onValueChange={(v) => set('maritalStatus', v === ' ' ? '' : v)} disabled={disabled}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {MARITAL_OPTIONS.map((o) => (
                    <SelectItem key={o || 'blank'} value={o || ' '}>{o || 'Select'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Blood Group</Label>
              <Select value={data.bloodGroup || ' '} onValueChange={(v) => set('bloodGroup', v === ' ' ? '' : v)} disabled={disabled}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {BLOOD_OPTIONS.map((o) => (
                    <SelectItem key={o || 'blank'} value={o || ' '}>{o || 'Select'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Official Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Official Information
          </CardTitle>
          <CardDescription>Staff ID, designation, employment details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Staff ID *</Label>
              <Input value={data.staffId} onChange={(e) => set('staffId', e.target.value)} placeholder="e.g. EMP-00421" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Designation *</Label>
              <Input value={data.designation} onChange={(e) => set('designation', e.target.value)} placeholder="e.g. Senior Analyst" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={data.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. Finance" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Division / Unit</Label>
              <Input value={data.division} onChange={(e) => set('division', e.target.value)} placeholder="e.g. Internal Audit" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select value={data.employmentType || ' '} onValueChange={(v) => set('employmentType', v === ' ' ? '' : v)} disabled={disabled}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_OPTIONS.map((o) => (
                    <SelectItem key={o || 'blank'} value={o || ' '}>{o || 'Select'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date of Joining *</Label>
              <Input type="date" value={data.dateOfJoining} onChange={(e) => set('dateOfJoining', e.target.value)} disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Contract End Date</Label>
              <Input type="date" value={data.contractEndDate} onChange={(e) => set('contractEndDate', e.target.value)} disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Reporting Official</Label>
              <Input value={data.reportingOfficial} onChange={(e) => set('reportingOfficial', e.target.value)} placeholder="Official's name" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Work Location</Label>
              <Input value={data.workLocation} onChange={(e) => set('workLocation', e.target.value)} placeholder="e.g. Head Office" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Office Extension</Label>
              <Input value={data.officeExtension} onChange={(e) => set('officeExtension', e.target.value)} placeholder="e.g. Ext. 4021" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Account Status</Label>
              <Select value={data.accountStatus || ' '} onValueChange={(v) => set('accountStatus', v === ' ' ? '' : v)} disabled={disabled}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o || 'blank'} value={o || ' '}>{o || 'Select'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Information
          </CardTitle>
          <CardDescription>Email, phone, address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Official Email *</Label>
              <Input type="email" value={data.email} onChange={(e) => set('email', e.target.value)} placeholder="email@company.org" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Personal Email</Label>
              <Input type="email" value={data.personalEmail} onChange={(e) => set('personalEmail', e.target.value)} placeholder="personal@example.com" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Phone (Primary) *</Label>
              <Input type="tel" value={data.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Phone (Alternate)</Label>
              <Input type="tel" value={data.phoneAlternate} onChange={(e) => set('phoneAlternate', e.target.value)} placeholder="+91 98765 00000" disabled={disabled} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Residential Address *</Label>
              <AiTextarea value={data.address} onChange={(e) => set('address', e.target.value)} placeholder="Address… (@Ai + Ctrl+Enter)" rows={2} disabled={disabled} fieldHint="Postal address" />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={data.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Mumbai" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Postal / ZIP Code</Label>
              <Input value={data.postalCode} onChange={(e) => set('postalCode', e.target.value)} placeholder="e.g. 400001" disabled={disabled} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Qualifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Qualifications & Skills
          </CardTitle>
          <CardDescription>Education and skills</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Highest Qualification</Label>
              <Select value={data.highestQualification || ' '} onValueChange={(v) => set('highestQualification', v === ' ' ? '' : v)} disabled={disabled}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {QUALIFICATION_OPTIONS.map((o) => (
                    <SelectItem key={o || 'blank'} value={o || ' '}>{o || 'Select'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Field of Study</Label>
              <Input value={data.fieldOfStudy} onChange={(e) => set('fieldOfStudy', e.target.value)} placeholder="e.g. Computer Science" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Institution</Label>
              <Input value={data.institution} onChange={(e) => set('institution', e.target.value)} placeholder="e.g. University of Delhi" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Year of Graduation</Label>
              <Input type="number" value={data.yearOfGraduation} onChange={(e) => set('yearOfGraduation', e.target.value)} placeholder="e.g. 2018" min={1950} max={2030} disabled={disabled} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Skills</Label>
              <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2">
                {data.skills.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm">
                    {s}
                    {!disabled && <button type="button" onClick={() => removeSkill(i)} className="text-muted-foreground hover:text-destructive">×</button>}
                  </span>
                ))}
                {!disabled && (
                  <input
                    type="text"
                    className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm outline-none"
                    placeholder="Type a skill and press Enter…"
                    onKeyDown={addSkill}
                  />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
            Emergency Contact
          </CardTitle>
          <CardDescription>Contact person in case of emergency</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={data.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} placeholder="Contact person's name" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Relationship *</Label>
              <Select value={data.emergencyContactRelationship || ' '} onValueChange={(v) => set('emergencyContactRelationship', v === ' ' ? '' : v)} disabled={disabled}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((o) => (
                    <SelectItem key={o || 'blank'} value={o || ' '}>{o || 'Select'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input type="tel" value={data.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} placeholder="+91 98765 43210" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Alternate Phone</Label>
              <Input type="tel" value={data.emergencyContactPhoneAlt} onChange={(e) => set('emergencyContactPhoneAlt', e.target.value)} placeholder="(optional)" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={data.emergencyContactEmail} onChange={(e) => set('emergencyContactEmail', e.target.value)} placeholder="(optional)" disabled={disabled} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes & Bio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Additional Notes
          </CardTitle>
          <CardDescription>Remarks, admin notes, bio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Remarks / Admin Notes</Label>
            <AiTextarea value={data.adminNotes} onChange={(e) => set('adminNotes', e.target.value)} placeholder="HR / admin notes… (@Ai + Ctrl+Enter)" rows={3} disabled={disabled} fieldHint="Staff admin notes" />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <AiTextarea value={data.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Brief bio… (@Ai + Ctrl+Enter)" rows={2} disabled={disabled} fieldHint="Staff bio" />
          </div>
        </CardContent>
      </Card>

      {showSubmit && onSubmit && (
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : submitLabel}
            {markComplete && ' & continue'}
          </Button>
        </div>
      )}
    </form>
  );
}
