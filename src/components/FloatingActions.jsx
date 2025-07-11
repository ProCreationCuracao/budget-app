import React from 'react';
import { Box, VStack, IconButton } from '@chakra-ui/react';
import { AiFillPlusCircle, AiOutlineWallet } from 'react-icons/ai';

/**
 * FloatingActions component renders two vertically stacked floating buttons:
 *  - Quick Add Transaction button
 *  - Add Account button
 *
 * Props:
 *  - onQuickAdd: callback when Quick Add button is clicked
 *  - onAddAccount: callback when Add Account button is clicked
 */
export default function FloatingActions({ onQuickAdd, onAddAccount }) {
  return (
    <Box position="fixed" bottom="4" right="4" zIndex="overlay">
      <VStack spacing={2}>
        <IconButton
          aria-label="Quick Add Transaction"
          icon={<AiFillPlusCircle size={28} />}
          colorScheme="teal"
          onClick={onQuickAdd}
        />
        <IconButton
          aria-label="Add New Account"
          icon={<AiOutlineWallet size={28} />}
          colorScheme="blue"
          onClick={onAddAccount}
        />
      </VStack>
    </Box>
  );
}
