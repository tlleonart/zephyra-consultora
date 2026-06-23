'use client';

import { signOutOrg } from '../../actions/signout-org';
import styles from './OrgSignoutButton.module.css';

export const OrgSignoutButton = () => {
  return (
    <form action={signOutOrg}>
      <button type="submit" className={styles.button}>
        Cerrar sesión
      </button>
    </form>
  );
};
