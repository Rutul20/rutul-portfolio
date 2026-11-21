import AnchorFix from '@/components/AnchorFix';
import SiteHeader from '@/components/SiteHeader';
import CityStage from '@/components/stage/CityStage';
import { About, ClientWork, Contact, Education, Experience, Flagship, Hero, Workshop } from '@/components/Sections';

export default function Home() {
  return (
    <>
      <CityStage />
      <AnchorFix />
      <div className="site-ui">
        <SiteHeader />
        <main id="main" tabIndex={-1} className="outline-none">
          <Hero />
          <About />
          <Experience />
          <Flagship />
          <ClientWork />
          <Workshop />
          <Education />
          <Contact />
        </main>
      </div>
    </>
  );
}
