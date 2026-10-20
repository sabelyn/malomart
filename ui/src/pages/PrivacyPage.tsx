import LegalDocument from "@/components/LegalDocument";
import { malo, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { privacyPolicy } from "@/content/privacyPolicy";

const PrivacyPage = () => {
  useDocumentTitle(ui.pageTitles.privacy);

  return (
    <LegalDocument
      heading={ui.privacy.heading}
      lastUpdated={privacyPolicy.lastUpdated}
      maloSays={malo.privacy}
      plainVersion={ui.privacy.plainVersion}
      sections={privacyPolicy.sections}
    />
  );
};

export default PrivacyPage;
