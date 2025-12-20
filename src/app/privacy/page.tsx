"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useWallet } from "@/contexts/wallet-context";
import { Card } from "@/components/ui/card";
import { Shield, Eye, Database, UserCheck } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function PrivacyPage() {
  const { walletAddress, handleDisconnect } = useWallet();
  const { t } = useTranslation();

  return (
    <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('privacy.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('privacy.subtitle')}</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">{t('privacy.collection.title')}</h3>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                {t('privacy.collection.desc')}
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('privacy.collection.item1')}</li>
                <li>{t('privacy.collection.item2')}</li>
                <li>{t('privacy.collection.item3')}</li>
              </ul>
            </div>
          </Card>

          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Database className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">{t('privacy.storage.title')}</h3>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                {t('privacy.storage.desc')}
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('privacy.storage.item1')}</li>
                <li>{t('privacy.storage.item2')}</li>
                <li>{t('privacy.storage.item3')}</li>
                <li>{t('privacy.storage.item4')}</li>
              </ul>
            </div>
          </Card>

          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <UserCheck className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">{t('privacy.rights.title')}</h3>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                {t('privacy.rights.desc')}
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('privacy.rights.item1')}</li>
                <li>{t('privacy.rights.item2')}</li>
                <li>{t('privacy.rights.item3')}</li>
                <li>{t('privacy.rights.item4')}</li>
              </ul>
            </div>
          </Card>

          <Card className="bg-card border-border p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">{t('privacy.thirdparty.title')}</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                {t('privacy.thirdparty.desc')}
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('privacy.thirdparty.item1')}</li>
                <li>{t('privacy.thirdparty.item2')}</li>
                <li>{t('privacy.thirdparty.item3')}</li>
              </ul>
              <p className="mt-4">
                {t('privacy.thirdparty.footer')}
              </p>
            </div>
          </Card>

          <Card className="bg-card border-border p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">{t('privacy.contact.title')}</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                {t('privacy.contact.desc')}
              </p>
              <div className="space-y-2">
                <p><strong>Email:</strong> privacy@etherview.io</p>
                <p><strong>GitHub:</strong> github.com/etherview</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
