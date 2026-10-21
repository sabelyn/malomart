import LegalDocument from "@/components/LegalDocument";
import { termsOfService } from "@/content/termsOfService";
import { malo, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const TermsPage = () => {
  useDocumentTitle(ui.pageTitles.terms);

  return (
    <LegalDocument
      heading={ui.terms.heading}
      lastUpdated={termsOfService.lastUpdated}
      maloSays={malo.terms}
      plainVersion={ui.terms.plainVersion}
      sections={termsOfService.sections}
    />
  );
};

export default TermsPage;
