/**
 * Bulk User Registration Utilities
 * Handles username/displayname generation and Vietnamese text processing
 */

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
 * Generate class name from school prefix, grade, and current year
 * Format: SCHOOLPREFIX_GRADE_CURRENTYEAR (all uppercase)
 */
export function generateClassName(schoolPrefix: string, grade: string): string {
  const currentYear = new Date().getFullYear();
  return `${schoolPrefix}_${grade}_${currentYear}`.toUpperCase();
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
  excelRows: Array<{ fullName: string; grade: string; phoneNumber: string }>,
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

      // Combine warnings
      const warnings = [
        fullNameWarning,
        gradeWarning,
        usernameWarning,
        classNameWarning,
        displayNameWarning
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
