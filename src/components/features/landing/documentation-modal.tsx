"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  AlertTriangle,
  Eye,
  BarChart3,
  HelpCircle,
  Lock,
  TrendingUp
} from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export function DocumentationModal({ trigger }: { trigger: React.ReactNode }) {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t('docs.title')}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="getting-started" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="getting-started">{t('docs.tabs.gettingStarted')}</TabsTrigger>
            <TabsTrigger value="features">{t('docs.tabs.features')}</TabsTrigger>
            <TabsTrigger value="security">{t('docs.tabs.security')}</TabsTrigger>
            <TabsTrigger value="faq">{t('docs.tabs.faq')}</TabsTrigger>
          </TabsList>

          <TabsContent value="getting-started" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {t('docs.quickStart')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">{t('docs.step1.title')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('docs.step1.desc')}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">{t('docs.step2.title')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('docs.step2.desc')}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">{t('docs.step3.title')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('docs.step3.desc')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    {t('docs.features.portfolio')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('docs.features.portfolio.desc')}
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• {t('portfolio.total_value')}</li>
                    <li>• {t('portfolio.eth_balance')}</li>
                    <li>• {t('portfolio.token_positions')}</li>
                    <li>• {t('portfolio.risk_assessment')}</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-green-500" />
                    {t('docs.features.whale')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('docs.features.whale.desc')}
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• {t('whale.totalEvents')}</li>
                    <li>• {t('whale.exchangeInflows')}</li>
                    <li>• {t('whale.impact_analysis')}</li>
                    <li>• {t('whale.confidence')}</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    {t('docs.features.scam')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('docs.features.scam.desc')}
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• {t('scam.riskLevel')}</li>
                    <li>• {t('scam.evidence')}</li>
                    <li>• {t('scam.score')}</li>
                    <li>• {t('scam.confidence')}</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-orange-500" />
                    {t('docs.features.news')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('docs.features.news.desc')}
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• {t('news.marketSummary')}</li>
                    <li>• {t('news.marketSentiment')}</li>
                    <li>• {t('news.aiPrediction')}</li>
                    <li>• {t('news.confidence')}</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t('docs.security.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">🔐 {t('docs.security.data')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('docs.security.data.desc')}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">🛡️ {t('docs.security.api')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('docs.security.api.desc')}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">⚡ {t('docs.security.bestPractices')}</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Never share your private keys</li>
                    <li>• Use hardware wallets for large amounts</li>
                    <li>• Double-check transaction details before signing</li>
                    <li>• Keep your software updated</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="faq" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  {t('docs.faq.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">{t('docs.faq.q1')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('docs.faq.a1')}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">{t('docs.faq.q2')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('docs.faq.a2')}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">{t('docs.faq.q3')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('docs.faq.a3')}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">{t('docs.faq.q4')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('docs.faq.a4')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
