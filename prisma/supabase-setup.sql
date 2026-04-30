-- ============================================================
--  ETA Academy — Supabase SQL Setup
--  Paste this entire file into Supabase SQL Editor and click Run
-- ============================================================

-- ENUMS
CREATE TYPE "Role" AS ENUM ('student', 'teacher', 'admin', 'billing_manager');
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'pending_verification', 'deleted');
CREATE TYPE "EnglishLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'all_levels');
CREATE TYPE "CourseLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'all_levels');
CREATE TYPE "CourseStatus" AS ENUM ('draft', 'pending_review', 'published', 'archived');
CREATE TYPE "PricingType" AS ENUM ('free', 'one_time', 'subscription');
CREATE TYPE "ContentType" AS ENUM ('video', 'audio', 'text', 'mixed');
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'completed', 'refunded', 'suspended');
CREATE TYPE "SubmissionStatus" AS ENUM ('submitted', 'graded', 'returned', 'late');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE "CertificateStatus" AS ENUM ('issued', 'revoked');

-- USERS
CREATE TABLE "User" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "email"               TEXT NOT NULL,
  "passwordHash"        TEXT NOT NULL,
  "firstName"           TEXT NOT NULL,
  "lastName"            TEXT NOT NULL,
  "avatarUrl"           TEXT,
  "role"                "Role" NOT NULL DEFAULT 'student',
  "status"              "UserStatus" NOT NULL DEFAULT 'pending_verification',
  "emailVerified"       BOOLEAN NOT NULL DEFAULT false,
  "verifyToken"         TEXT,
  "resetToken"          TEXT,
  "resetTokenExpiresAt" TIMESTAMP(3),
  "lastLoginAt"         TIMESTAMP(3),
  "timezone"            TEXT NOT NULL DEFAULT 'UTC',
  "locale"              TEXT NOT NULL DEFAULT 'en',
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- REFRESH TOKENS
CREATE TABLE "RefreshToken" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revoked"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- STUDENTS
CREATE TABLE "Student" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"         TEXT NOT NULL,
  "englishLevel"   "EnglishLevel" NOT NULL DEFAULT 'A1',
  "bio"            TEXT,
  "goals"          TEXT,
  "xpPoints"       INTEGER NOT NULL DEFAULT 0,
  "streakDays"     INTEGER NOT NULL DEFAULT 0,
  "lastActivityAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TEACHERS
CREATE TABLE "Teacher" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"          TEXT NOT NULL,
  "bio"             TEXT,
  "specializations" TEXT[] NOT NULL DEFAULT '{}',
  "qualifications"  TEXT[] NOT NULL DEFAULT '{}',
  "rating"          DECIMAL(3,2) NOT NULL DEFAULT 0,
  "ratingCount"     INTEGER NOT NULL DEFAULT 0,
  "isVerified"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CATEGORIES
CREATE TABLE "Category" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "description" TEXT,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- COURSES
CREATE TABLE "Course" (
  "id"                      TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "teacherId"               TEXT NOT NULL,
  "categoryId"              TEXT,
  "title"                   TEXT NOT NULL,
  "slug"                    TEXT NOT NULL,
  "description"             TEXT NOT NULL,
  "shortDescription"        TEXT,
  "thumbnailUrl"            TEXT,
  "level"                   "CourseLevel" NOT NULL DEFAULT 'all_levels',
  "status"                  "CourseStatus" NOT NULL DEFAULT 'draft',
  "pricingType"             "PricingType" NOT NULL DEFAULT 'one_time',
  "price"                   DECIMAL(10,2) NOT NULL DEFAULT 0,
  "currency"                TEXT NOT NULL DEFAULT 'USD',
  "durationHours"           DECIMAL(6,2),
  "certificateOnCompletion" BOOLEAN NOT NULL DEFAULT true,
  "completionThreshold"     INTEGER NOT NULL DEFAULT 80,
  "ratingAvg"               DECIMAL(3,2) NOT NULL DEFAULT 0,
  "ratingCount"             INTEGER NOT NULL DEFAULT 0,
  "enrollmentCount"         INTEGER NOT NULL DEFAULT 0,
  "publishedAt"             TIMESTAMP(3),
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");
ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Course" ADD CONSTRAINT "Course_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- LESSONS
CREATE TABLE "Lesson" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "courseId"        TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "description"     TEXT,
  "contentType"     "ContentType" NOT NULL DEFAULT 'text',
  "videoUrl"        TEXT,
  "audioUrl"        TEXT,
  "contentHtml"     TEXT,
  "durationSeconds" INTEGER,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "isPreview"       BOOLEAN NOT NULL DEFAULT false,
  "isPublished"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Lesson_courseId_idx" ON "Lesson"("courseId");
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ASSIGNMENTS
CREATE TABLE "Assignment" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "courseId"       TEXT NOT NULL,
  "lessonId"       TEXT,
  "title"          TEXT NOT NULL,
  "instructions"   TEXT NOT NULL,
  "rubric"         TEXT,
  "submissionType" TEXT NOT NULL DEFAULT 'text',
  "maxScore"       INTEGER NOT NULL DEFAULT 100,
  "passingScore"   INTEGER NOT NULL DEFAULT 60,
  "dueDays"        INTEGER,
  "isRequired"     BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Assignment_courseId_idx" ON "Assignment"("courseId");
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ENROLLMENTS
CREATE TABLE "Enrollment" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "studentId"      TEXT NOT NULL,
  "courseId"       TEXT NOT NULL,
  "status"         "EnrollmentStatus" NOT NULL DEFAULT 'active',
  "enrolledAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"    TIMESTAMP(3),
  "progressPct"    DECIMAL(5,2) NOT NULL DEFAULT 0,
  "lastAccessedAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Enrollment_studentId_courseId_key" ON "Enrollment"("studentId","courseId");
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PROGRESS
CREATE TABLE "Progress" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "enrollmentId" TEXT NOT NULL,
  "lessonId"     TEXT NOT NULL,
  "completed"    BOOLEAN NOT NULL DEFAULT false,
  "completedAt"  TIMESTAMP(3),
  "watchSeconds" INTEGER NOT NULL DEFAULT 0,
  "lastPosition" INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Progress_enrollmentId_lessonId_key" ON "Progress"("enrollmentId","lessonId");
CREATE INDEX "Progress_enrollmentId_idx" ON "Progress"("enrollmentId");
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SUBMISSIONS
CREATE TABLE "Submission" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "assignmentId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "studentId"    TEXT NOT NULL,
  "status"       "SubmissionStatus" NOT NULL DEFAULT 'submitted',
  "contentText"  TEXT,
  "fileUrl"      TEXT,
  "fileName"     TEXT,
  "score"        INTEGER,
  "grade"        TEXT,
  "feedback"     TEXT,
  "gradedById"   TEXT,
  "gradedAt"     TIMESTAMP(3),
  "submittedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Submission_assignmentId_idx" ON "Submission"("assignmentId");
CREATE INDEX "Submission_enrollmentId_idx" ON "Submission"("enrollmentId");
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_gradedById_fkey"
  FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PAYMENTS
CREATE TABLE "Payment" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "enrollmentId"          TEXT,
  "studentId"             TEXT NOT NULL,
  "courseId"              TEXT NOT NULL,
  "stripePaymentIntentId" TEXT,
  "amount"                DECIMAL(10,2) NOT NULL,
  "currency"              TEXT NOT NULL DEFAULT 'USD',
  "status"                "PaymentStatus" NOT NULL DEFAULT 'pending',
  "discountAmount"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  "refundAmount"          DECIMAL(10,2) NOT NULL DEFAULT 0,
  "refundedAt"            TIMESTAMP(3),
  "invoicePdfUrl"         TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");
CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");
CREATE INDEX "Payment_courseId_idx" ON "Payment"("courseId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CERTIFICATES
CREATE TABLE "Certificate" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "studentId"         TEXT NOT NULL,
  "courseId"          TEXT NOT NULL,
  "enrollmentId"      TEXT NOT NULL,
  "certificateNumber" TEXT NOT NULL,
  "status"            "CertificateStatus" NOT NULL DEFAULT 'issued',
  "pdfUrl"            TEXT,
  "verificationUrl"   TEXT,
  "issuedById"        TEXT,
  "issuedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"         TIMESTAMP(3),
  "revokeReason"      TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");
CREATE UNIQUE INDEX "Certificate_studentId_courseId_key" ON "Certificate"("studentId","courseId");
CREATE INDEX "Certificate_studentId_idx" ON "Certificate"("studentId");
CREATE INDEX "Certificate_courseId_idx" ON "Certificate"("courseId");
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_issuedById_fkey"
  FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
--  SEED DATA
-- ============================================================

-- Categories
INSERT INTO "Category" ("id", "name", "slug", "description", "sortOrder") VALUES
  (gen_random_uuid()::text, 'General English', 'general-english', 'Foundational English for everyday communication', 1),
  (gen_random_uuid()::text, 'Business English', 'business-english', 'Professional English for the workplace', 2),
  (gen_random_uuid()::text, 'IELTS Preparation', 'ielts-prep', 'Structured preparation for the IELTS exam', 3),
  (gen_random_uuid()::text, 'Conversational', 'conversational', 'Fluency and speaking confidence', 4);

-- Done! All tables and seed data created successfully.
