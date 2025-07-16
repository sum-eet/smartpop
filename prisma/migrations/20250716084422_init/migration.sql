-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "popups" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" TEXT NOT NULL,
    "triggerValue" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "description" TEXT,
    "buttonText" TEXT NOT NULL DEFAULT 'Get Discount',
    "discountCode" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "popups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "popup_analytics" (
    "id" TEXT NOT NULL,
    "popupId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "referrer" TEXT,

    CONSTRAINT "popup_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "popups_shop_isActive_idx" ON "popups"("shop", "isActive");

-- CreateIndex
CREATE INDEX "popup_analytics_popupId_event_idx" ON "popup_analytics"("popupId", "event");

-- CreateIndex
CREATE INDEX "popup_analytics_timestamp_idx" ON "popup_analytics"("timestamp");

-- AddForeignKey
ALTER TABLE "popup_analytics" ADD CONSTRAINT "popup_analytics_popupId_fkey" FOREIGN KEY ("popupId") REFERENCES "popups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
