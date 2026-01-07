/**
 * Bulk User Registration Utilities
 * Handles username/displayname generation and Vietnamese text processing
 */

import { DEFAULT_YEAR } from '@/lib/migrationConstants'

/**
 * Remove Vietnamese diacritics using Unicode normalization
 * Example: "Nguyễn Văn A" → "Nguyen Van A"
 */
export function removeVietnameseSigns(text: string): string {
  if (!text) return '';

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Validate fullName for special characters
 * Returns warning message if special characters found, null otherwise
 * Allows: Unicode letters (including Vietnamese), numbers, spaces
 */
export function validateFullName(fullName: string): string | null {
  if (!fullName) return null;

  // Match only letters (including Unicode), numbers, and spaces
  // \p{L} matches any Unicode letter
  // \p{N} matches any Unicode number
  const validPattern = /^[\p{L}\p{N}\s]+$/u;

  if (!validPattern.test(fullName)) {
    // Find the special characters
    const specialChars = fullName.replace(/[\p{L}\p{N}\s]/gu, '');
    const uniqueChars = [...new Set(specialChars)].join(', ');
    return `Special chars: ${uniqueChars}`;
  }

  return null;
}

/**
 * Validate grade for invalid characters
 * Returns warning message if invalid characters found, null otherwise
 * Allows: Only ASCII letters (a-zA-Z) and numbers (0-9)
 * NOT allowed: Unicode characters, spaces, special characters
 */
export function validateGrade(grade: string): string | null {
  if (!grade) return null;

  // Only allow a-zA-Z and 0-9
  const validPattern = /^[a-zA-Z0-9]+$/;

  if (!validPattern.test(grade)) {
    // Find the invalid characters
    const invalidChars = grade.replace(/[a-zA-Z0-9]/g, '');
    const uniqueChars = [...new Set(invalidChars)].join(', ');
    if (uniqueChars) {
      return `Invalid grade: ${uniqueChars}`;
    }
    return 'Grade has invalid characters';
  }

  return null;
}

/**
 * Validate username for invalid characters
 * Returns warning message if invalid characters found, null otherwise
 * Allows: Only ASCII letters (a-zA-Z) and numbers (0-9)
 */
export function validateUsername(username: string): string | null {
  if (!username) return null;

  const validPattern = /^[a-zA-Z0-9]+$/;

  if (!validPattern.test(username)) {
    const invalidChars = username.replace(/[a-zA-Z0-9]/g, '');
    const uniqueChars = [...new Set(invalidChars)].join(', ');
    if (uniqueChars) {
      return `Invalid username chars: ${uniqueChars}`;
    }
    return 'Username has invalid characters';
  }

  return null;
}

/**
 * Validate className for invalid characters
 * Returns warning message if invalid characters found, null otherwise
 * Allows: Only ASCII letters (a-zA-Z), numbers (0-9), and underscore (_)
 */
export function validateClassName(className: string): string | null {
  if (!className) return null;

  const validPattern = /^[a-zA-Z0-9_]+$/;

  if (!validPattern.test(className)) {
    const invalidChars = className.replace(/[a-zA-Z0-9_]/g, '');
    const uniqueChars = [...new Set(invalidChars)].join(', ');
    if (uniqueChars) {
      return `Invalid class chars: ${uniqueChars}`;
    }
    return 'Class name has invalid characters';
  }

  return null;
}

/**
 * Validate displayName for special characters
 * Returns warning message if special characters found, null otherwise
 * Allows: Unicode letters (including Vietnamese), numbers, spaces
 * NOT allowed: Special characters like @#$%^&*()
 */
export function validateDisplayName(displayName: string): string | null {
  if (!displayName) return null;

  // Match only letters (including Unicode), numbers, and spaces
  const validPattern = /^[\p{L}\p{N}\s]+$/u;

  if (!validPattern.test(displayName)) {
    const specialChars = displayName.replace(/[\p{L}\p{N}\s]/gu, '');
    const uniqueChars = [...new Set(specialChars)].join(', ');
    if (uniqueChars) {
      return `Invalid display chars: ${uniqueChars}`;
    }
    return 'Display name has special characters';
  }

  return null;
}

/**
 * Validate birthDate for parseable format and reasonable age
 * Returns warning message if:
 * - birth date can't be parsed or has invalid format
 * - calculated age >= 16 (unusual for student migration)
 * Allows: Valid date formats (DD-Mon-YY, D/M/YYYY, YYYY, etc.)
 * NOT allowed: Random text, excessive special characters
 */
export function validateBirthDate(birthDate: string | number | Date | null | undefined): string | null {
  if (birthDate === null || birthDate === undefined || birthDate === '') {
    return null; // Empty is OK, birthDate is optional
  }

  // Try to parse the date
  const parsed = parseBirthDate(birthDate);

  if (parsed === null) {
    // Could not parse - check for special characters or invalid format
    const strValue = String(birthDate).trim();

    // Check for problematic characters (excluding normal date separators)
    const invalidChars = strValue.replace(/[\p{L}\p{N}\s\/\-\.]/gu, '');
    if (invalidChars) {
      const uniqueChars = [...new Set(invalidChars)].join(', ');
      return `Invalid date chars: ${uniqueChars}`;
    }

    return `Cannot parse date: "${strValue}"`;
  }

  // Check if age >= 16 (unusual for student migration)
  const age = calculateAge(parsed);
  if (age !== null && age >= 16) {
    return `Age ${age} >= 16`;
  }

  return null;
}

/**
 * Generate username from full name following the algorithm:
 * schoolPrefix + lastName + firstLettersOfOtherNames
 * Length: 6-20 characters
 */
export function generateUsername(fullName: string, schoolPrefix: string): string {
  const normalized = removeVietnameseSigns(fullName.trim());
  const words = normalized.split(' ').filter(w => w.length > 0);

  if (words.length === 0) return '';

  // Get last name
  let lastName = words[words.length - 1];
  const otherWords = words.slice(0, -1);

  while (true) {
    // Generate username
    const firstLetters = otherWords.map(w => w[0]).join('');
    const username = (schoolPrefix + lastName + firstLetters).toLowerCase();

    // Check length constraints
    if (username.length < 6 && otherWords.length > 0) {
      // Username too short, append previous word to lastName
      const prevWord = otherWords.pop();
      if (prevWord) {
        lastName = prevWord + lastName;
      } else {
        // No more words to append, pad with zeros
        return username.padEnd(6, '0');
      }
    } else if (username.length < 6) {
      // No more words to append, pad with zeros
      return username.padEnd(6, '0');
    } else if (username.length > 20) {
      // Username too long
      console.warn(`INVALID_MAX_LENGTH_OF_USER: ${username}`);
      return username.substring(0, 20);
    } else {
      return username;
    }
  }
}

/**
 * Generate display name from full name
 * Takes last two words of full name, max 20 characters
 */
export function generateDisplayName(fullName: string): string {
  const words = fullName.trim().split(' ').filter(w => w.length > 0);

  if (words.length === 0) return '';

  // Get last two words
  let displayName: string;
  if (words.length === 1) {
    displayName = words[0];
  } else {
    const lastName = words[words.length - 1];
    const secondLast = words[words.length - 2];
    displayName = `${secondLast} ${lastName}`;
  }

  // Handle max length constraint
  if (displayName.length > 20) {
    console.warn(`INVALID_MAX_LENGTH_OF_USER_DISPLAYNAME: ${displayName}`);
    // Try last word only
    const lastWord = displayName.split(' ').pop();
    if (lastWord && lastWord.length <= 20) {
      displayName = lastWord;
    } else {
      // Truncate to 20 characters
      displayName = displayName.substring(0, 20);
    }
  }

  return displayName;
}

/**
 * Generate random 4-digit password
 */
export function generatePassword(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Month name mapping for parsing dates like "23-May-19"
 */
const MONTH_MAP: Record<string, number> = {
  'jan': 0, 'january': 0,
  'feb': 1, 'february': 1,
  'mar': 2, 'march': 2,
  'apr': 3, 'april': 3,
  'may': 4,
  'jun': 5, 'june': 5,
  'jul': 6, 'july': 6,
  'aug': 7, 'august': 7,
  'sep': 8, 'september': 8,
  'oct': 9, 'october': 9,
  'nov': 10, 'november': 10,
  'dec': 11, 'december': 11
};

/**
 * Parse birth date from various formats commonly found in Vietnamese Excel files
 * Supported formats:
 * - DD-Mon-YY or D-Mon-YY (e.g., "23-May-19", "6-Apr-19")
 * - DD/MM/YYYY or D/M/YYYY (e.g., "5/6/2015", "30/4/2015")
 * - DD-MM-YYYY or D-M-YYYY
 * - YYYY only (e.g., "2015", "2018")
 * - Excel serial date number (e.g., 43608)
 * - Date object (passed directly from Excel parser)
 * 
 * @param dateValue - The date value from Excel (can be string, number, or Date)
 * @returns Parsed Date object, or null if parsing fails
 */
export function parseBirthDate(dateValue: string | number | Date | null | undefined): Date | null {
  if (dateValue === null || dateValue === undefined || dateValue === '') {
    return null;
  }

  // If already a Date object
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) return null;
    return dateValue;
  }

  // Excel serial date (number) or year-only number
  if (typeof dateValue === 'number') {
    // Check if this looks like a year (4-digit number between 1900-2100)
    // Excel might read "2015" as number 2015 instead of string "2015"
    if (dateValue >= 1900 && dateValue <= 2100) {
      // Treat as year - default to July 1st (middle of year)
      return new Date(dateValue, 6, 1);
    }

    // Otherwise treat as Excel serial date: days since 1900-01-01
    // Excel serial dates: 1 = 1900-01-01 (with Excel's leap year bug)
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    const resultDate = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);

    // Validate reasonable birth year (1900-2025)
    if (resultDate.getFullYear() >= 1900 && resultDate.getFullYear() <= 2025) {
      return resultDate;
    }
    return null;
  }

  // String value
  const str = String(dateValue).trim();
  if (!str) return null;

  // Format 1: Year only (e.g., "2015", "2018")
  if (/^\d{4}$/.test(str)) {
    const year = parseInt(str, 10);
    if (year >= 1900 && year <= 2025) {
      // Default to July 1st (middle of year) for year-only dates
      return new Date(year, 6, 1);
    }
    return null;
  }

  // Format 2: DD-Mon-YY or D-Mon-YY (e.g., "23-May-19", "6-Apr-19")
  const monthNameMatch = str.match(/^(\d{1,2})[\/\-]([a-zA-Z]+)[\/\-](\d{2,4})$/);
  if (monthNameMatch) {
    const day = parseInt(monthNameMatch[1], 10);
    const monthName = monthNameMatch[2].toLowerCase();
    let year = parseInt(monthNameMatch[3], 10);

    const month = MONTH_MAP[monthName];
    if (month !== undefined && day >= 1 && day <= 31) {
      // Handle 2-digit year
      if (year < 100) {
        // Assume 00-30 is 2000-2030, 31-99 is 1931-1999
        year = year <= 30 ? 2000 + year : 1900 + year;
      }
      return new Date(year, month, day);
    }
  }

  // Format 3: DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, D-M-YYYY
  const numericMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    const month = parseInt(numericMatch[2], 10) - 1; // 0-indexed
    let year = parseInt(numericMatch[3], 10);

    // Handle 2-digit year
    if (year < 100) {
      year = year <= 30 ? 2000 + year : 1900 + year;
    }

    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 1900 && year <= 2025) {
      return new Date(year, month, day);
    }
  }

  // Format 4: YYYY/MM/DD or YYYY-MM-DD (ISO-like)
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);

    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 1900 && year <= 2025) {
      return new Date(year, month, day);
    }
  }

  // Try native Date parsing as last resort
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      if (year >= 1900 && year <= 2025) {
        return parsed;
      }
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}

/**
 * Calculate age from birth date (year-based only)
 * Simply calculates: currentYear - birthYear
 * Anyone born in the same year will have the same age
 * 
 * @param birthDate - Birth date (Date object or parseable value)
 * @param referenceYear - Reference year for age calculation (default: current year)
 * @returns Age in years, or null if birth date is invalid
 */
export function calculateAge(
  birthDate: string | number | Date | null | undefined,
  referenceYear: number = new Date().getFullYear()
): number | null {
  const parsedDate = birthDate instanceof Date ? birthDate : parseBirthDate(birthDate);

  if (!parsedDate) return null;

  const age = referenceYear - parsedDate.getFullYear();

  // Validate reasonable age (0-150)
  if (age >= 0 && age <= 150) {
    return age;
  }

  return null;
}

/**
 * Parse birth date and calculate age - convenience function
 * Returns an object with both parsed date and calculated age
 * 
 * @param dateValue - The date value from Excel
 * @returns Object with { birthDate, age } or { birthDate: null, age: null } if invalid
 */
export function parseBirthDateAndAge(dateValue: string | number | Date | null | undefined): {
  birthDate: Date | null;
  age: number | null;
  formattedDate: string | null;
} {
  const birthDate = parseBirthDate(dateValue);

  if (!birthDate) {
    return { birthDate: null, age: null, formattedDate: null };
  }

  const age = calculateAge(birthDate);
  const formattedDate = `${birthDate.getDate().toString().padStart(2, '0')}/${(birthDate.getMonth() + 1).toString().padStart(2, '0')}/${birthDate.getFullYear()}`;

  return { birthDate, age, formattedDate };
}

/**
 * Generate class name from school prefix, grade, and year
 * Format: SCHOOLPREFIX_GRADE_YEAR (all uppercase)
 * Uses DEFAULT_YEAR from migrationConstants
 */
export function generateClassName(schoolPrefix: string, grade: string): string {
  return `${schoolPrefix}_${grade}_${DEFAULT_YEAR}`.toUpperCase();
}

/**
 * Generate teacher username/displayname
 * Format: schoolPrefix + "gv" + grade (if grade provided)
 * Format: schoolPrefix + "gv" (if no grade provided - for general school teacher)
 */
export function generateTeacherAccount(schoolPrefix: string, grade?: string) {
  const username = grade
    ? `${schoolPrefix}gv${grade}`.toLowerCase()
    : `${schoolPrefix}gv`.toLowerCase();
  return {
    username,
    displayName: username, // Same as username
    password: generatePassword()
  };
}

/**
 * Return username without adding numeric suffix
 * The backend will handle duplicate usernames by adding numbers
 */
export function resolveUsernameConflict(
  baseUsername: string,
  existingUsernames: Set<string>
): string {
  // Don't add numbers here - let the backend handle it
  return baseUsername;
}

/**
 * Return display name without adding numeric suffix
 * The backend will handle duplicate display names by adding numbers
 */
export function resolveDisplayNameConflict(
  baseDisplayName: string,
  existingDisplayNames: Set<string>
): string {
  // Don't add numbers here - let the backend handle it
  return baseDisplayName;
}

/**
 * Student data interface
 */
export interface StudentData {
  fullName: string;
  grade: string;
  phoneNumber: string;
  username: string;
  displayName: string;
  password: string;
  className: string;
  birthDate?: string; // Original birth date value from Excel (formatted)
  age?: number; // Calculated age (year-based: currentYear - birthYear)
  warning?: string; // Warning message for special characters, etc.
}

/**
 * Teacher data interface
 */
export interface TeacherData {
  username: string;
  displayName: string;
  password: string;
  grade: string;
  className: string;
  warning?: string; // Warning message for validation issues
}

/**
 * Process Excel data and generate student/teacher accounts
 */
export interface ProcessedData {
  students: StudentData[];
  teachers: TeacherData[];
  errors: Array<{ row: number; message: string }>;
}

export function processExcelData(
  excelRows: Array<{ fullName: string; grade: string; phoneNumber: string; birthDate?: string | number | Date }>,
  schoolPrefix: string,
  existingUsernames: Set<string> = new Set(),
  existingDisplayNames: Set<string> = new Set()
): ProcessedData {
  const students: StudentData[] = [];
  const teachers: Map<string, TeacherData> = new Map();
  const errors: Array<{ row: number; message: string }> = [];

  const localUsernames = new Set<string>(existingUsernames);
  const localDisplayNames = new Set<string>(existingDisplayNames);

  excelRows.forEach((row, index) => {
    try {
      const { fullName, grade, phoneNumber } = row;

      // Validate required fields
      if (!fullName || !grade) {
        errors.push({
          row: index + 1,
          message: 'Missing fullName or grade'
        });
        return;
      }

      // Trim and validate grade (convert to uppercase)
      const trimmedGrade = grade.toString().trim().toUpperCase();
      if (!trimmedGrade) {
        errors.push({
          row: index + 1,
          message: 'Grade is empty'
        });
        return;
      }

      // Generate username and display name
      const baseUsername = generateUsername(fullName, schoolPrefix);
      const baseDisplayName = generateDisplayName(fullName);

      // Resolve conflicts
      const username = resolveUsernameConflict(baseUsername, localUsernames);
      const displayName = resolveDisplayNameConflict(baseDisplayName, localDisplayNames);

      // Add to local sets to prevent duplicates within this batch
      localUsernames.add(username.toLowerCase());
      localDisplayNames.add(displayName.toLowerCase());

      // Generate class name
      const className = generateClassName(schoolPrefix, trimmedGrade);

      // Validate all fields
      const fullNameWarning = validateFullName(fullName);
      const gradeWarning = validateGrade(trimmedGrade);
      const usernameWarning = validateUsername(username);
      const classNameWarning = validateClassName(className);
      const displayNameWarning = validateDisplayName(displayName);

      // Parse and validate birth date
      const birthDateValue = (row as any).birthDate;
      const birthDateWarning = validateBirthDate(birthDateValue);
      const parsedBirthDate = parseBirthDateAndAge(birthDateValue);

      // Combine warnings
      const warnings = [
        fullNameWarning,
        gradeWarning,
        usernameWarning,
        classNameWarning,
        displayNameWarning,
        birthDateWarning
      ].filter(Boolean);
      const combinedWarning = warnings.length > 0 ? warnings.join('; ') : undefined;

      // Create student data
      students.push({
        fullName,
        grade: trimmedGrade,
        phoneNumber: phoneNumber || '',
        username,
        displayName,
        password: generatePassword(),
        className,
        birthDate: parsedBirthDate.formattedDate || undefined,
        age: parsedBirthDate.age || undefined,
        warning: combinedWarning
      });

      // Create teacher account for this grade if not exists
      if (!teachers.has(trimmedGrade)) {
        const teacherAccount = generateTeacherAccount(schoolPrefix, trimmedGrade);
        const teacherUsername = resolveUsernameConflict(
          teacherAccount.username,
          localUsernames
        );

        localUsernames.add(teacherUsername.toLowerCase());

        // Validate teacher fields
        const teacherUsernameWarning = validateUsername(teacherUsername);
        const teacherDisplayNameWarning = validateDisplayName(teacherUsername);
        const teacherClassNameWarning = validateClassName(className);
        const teacherWarnings = [
          teacherUsernameWarning,
          teacherDisplayNameWarning,
          teacherClassNameWarning
        ].filter(Boolean);

        teachers.set(trimmedGrade, {
          ...teacherAccount,
          username: teacherUsername,
          displayName: teacherUsername,
          grade: trimmedGrade,
          className,
          warning: teacherWarnings.length > 0 ? teacherWarnings.join('; ') : undefined
        });
      }
    } catch (error) {
      errors.push({
        row: index + 1,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Always create admin teacher account (schoolPrefix + "gv")
  // Migration service will check if it exists before creating
  const generalTeacherKey = '__SCHOOL__'; // Special key for general teacher
  const generalTeacherAccount = generateTeacherAccount(schoolPrefix);
  const generalTeacherUsername = resolveUsernameConflict(
    generalTeacherAccount.username,
    localUsernames
  );

  localUsernames.add(generalTeacherUsername.toLowerCase());

  // Validate admin teacher fields
  const adminUsernameWarning = validateUsername(generalTeacherUsername);
  const adminDisplayNameWarning = validateDisplayName(generalTeacherUsername);
  const adminClassNameWarning = validateClassName(schoolPrefix.toUpperCase());
  const adminWarnings = [
    adminUsernameWarning,
    adminDisplayNameWarning,
    adminClassNameWarning
  ].filter(Boolean);

  teachers.set(generalTeacherKey, {
    ...generalTeacherAccount,
    username: generalTeacherUsername,
    displayName: generalTeacherUsername,
    grade: '', // No specific grade for general teacher
    className: schoolPrefix.toUpperCase(), // Class name is the school prefix itself (uppercase)
    warning: adminWarnings.length > 0 ? adminWarnings.join('; ') : undefined
  });

  return {
    students,
    teachers: Array.from(teachers.values()),
    errors
  };
}
