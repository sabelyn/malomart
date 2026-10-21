import LegalDocument from "@/components/LegalDocument";
import { privacyPolicy } from "@/content/privacyPolicy";
import { malo, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

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
