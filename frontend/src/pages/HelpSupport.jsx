import React, { useState } from 'react';
import SupportSearch from '../components/help/SupportSearch';
import PopularTopics from '../components/help/PopularTopics';
import FAQAccordion from '../components/help/FAQAccordion';
import VideoTutorials from '../components/help/VideoTutorials';
import ContactSupport from '../components/help/ContactSupport';
import SubmitTicketForm from '../components/help/SubmitTicketForm';
import SystemStatus from '../components/help/SystemStatus';
import UsefulResources from '../components/help/UsefulResources';
import ImmediateHelpBanner from '../components/help/ImmediateHelpBanner';

const HelpSupport = () => {
  const [search, setSearch] = useState('');

  // Handler to open live chat from banner
  const handleOpenChat = () => {
    // Scroll to ContactSupport section which has the live chat button
    const contactSection = document.querySelector('[data-section="contact"]');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Trigger the "Start Live Chat" button after scroll
      setTimeout(() => {
        const chatBtn = contactSection.querySelector('button');
        chatBtn?.click();
      }, 600);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#080d16] p-6 lg:p-8 font-['Inter',sans-serif]">
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Help &amp; Support
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
          Find guides, FAQs, tutorials, and contact our support team.
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-10">
        {/* Search */}
        <SupportSearch search={search} setSearch={setSearch} />

        {/* Popular Topics — filtered by search */}
        <PopularTopics search={search} />

        {/* FAQ + Contact split layout */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8" id="faq-section">
          <div className="xl:col-span-3">
            <FAQAccordion search={search} />
          </div>
          <div className="xl:col-span-2" data-section="contact">
            <ContactSupport />
          </div>
        </div>

        {/* Video Tutorials — filtered by search */}
        <VideoTutorials search={search} />

        {/* System Status + Resources split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <SystemStatus />
          <UsefulResources />
        </div>

        {/* Ticket Form */}
        <SubmitTicketForm />

        {/* Banner with live chat handler */}
        <ImmediateHelpBanner onOpenChat={handleOpenChat} />
      </div>
    </div>
  );
};

export default HelpSupport;
