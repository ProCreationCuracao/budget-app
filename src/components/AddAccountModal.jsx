// src/components/AddAccountModal.jsx
import React, { useState } from 'react';
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  useToast
} from '@chakra-ui/react';
import { supabase } from '../supabaseClient';

export default function AddAccountModal({ isOpen, onClose, onAccountAdded }) {
  const [name, setName] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [type, setType] = useState('Checking');
  const toast = useToast();

  const handleSubmit = async () => {
    const { data, error } = await supabase
      .from('accounts')
      .insert([{
        name,
        opening_balance: openingBalance,
        balance: openingBalance,
        type
      }]);
    if (error) {
      toast({ status: 'error', title: 'Error creating account', description: error.message });
    } else {
      toast({ status: 'success', title: 'Account added', description: name });
      onAccountAdded(data[0]);
      onClose();
      // reset form
      setName('');
      setOpeningBalance(0);
      setType('Checking');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>New Account</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={4}>
            <FormLabel>Name</FormLabel>
            <Input
              placeholder="e.g. Savings"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </FormControl>

          <FormControl mb={4}>
            <FormLabel>Opening Balance</FormLabel>
            <NumberInput
              precision={2}
              step={10}
              value={openingBalance}
              onChange={(_, v) => setOpeningBalance(v)}
            >
              <NumberInputField />
            </NumberInput>
          </FormControl>

          <FormControl>
            <FormLabel>Type</FormLabel>
            <Select value={type} onChange={e => setType(e.target.value)}>
              <option>Checking</option>
              <option>Savings</option>
              <option>Cash</option>
              <option>Credit Card</option>
            </Select>
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose} mr={3}>Cancel</Button>
          <Button colorScheme="blue" onClick={handleSubmit} isDisabled={!name}>
            Create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
