import { useNavigate } from 'react-router-dom';
import HomeIntro from '../components/HomeIntro';
import { useIntro } from '../App';

export default function Landing() {
  const navigate = useNavigate();
  const { setIntroActive } = useIntro();

  const handleTransition = () => {
    // Mark landing page as seen
    localStorage.setItem('hasSeenLanding', 'true');

    // Hide intro and navigate to home
    setIntroActive(false);

    // Small delay to allow intro to fade out
    setTimeout(() => {
      navigate('/');
    }, 300);
  };

  return <HomeIntro onTransition={handleTransition} />;
}

